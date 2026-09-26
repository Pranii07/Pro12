"""
NeuroScreen — Speech Feature Extraction Service
==================================================
Extracts behavioural features from audio recordings:
  - Speech rate (WPM) via Vosk transcript
  - Pause duration analysis via Librosa energy segmentation
  - Fluency score (speech time / total time)
  - Transcript (Vosk STT, graceful fallback if model unavailable)

All processing is done IN MEMORY. Raw audio bytes are never written
to disk or any persistent storage. They are garbage collected after
feature extraction completes.

Speech-to-Text engine: Vosk (offline, open-source)
  - English model: vosk-model-small-en-us (~40MB)
  - Kannada model: vosk-model-small-kn (~50MB)
  - Models must be downloaded separately; see docs/setup.md
"""

from __future__ import annotations

import io
import json
import logging
import wave
from typing import Optional

import numpy as np

logger = logging.getLogger("neuroscreen.speech")


class SpeechProcessor:
    """
    Stateless speech feature extractor.

    All methods take raw audio data and return numeric features.
    No state is retained between calls — each invocation is independent.
    """

    def __init__(self):
        self._vosk_models: dict[str, object] = {}

    def extract_features(
        self,
        audio_bytes: bytes,
        language: str = "en",
    ) -> dict:
        """
        Extract all speech features from raw audio bytes (WAV format).

        Args:
            audio_bytes: Raw WAV audio data
            language: Language code ('en' or 'kn')

        Returns:
            dict with speech_rate_wpm, avg_pause_duration_ms, fluency_score,
            transcript, duration_seconds, processing_note
        """
        notes: list[str] = []

        try:
            # Load audio with Librosa (from bytes)
            import librosa
            import soundfile as sf

            audio_buffer = io.BytesIO(audio_bytes)
            y, sr = sf.read(audio_buffer)

            # Convert to mono if stereo
            if len(y.shape) > 1:
                y = np.mean(y, axis=1)

            # Ensure float32
            y = y.astype(np.float32)
            duration_seconds = len(y) / sr

            if duration_seconds < 0.5:
                return self._empty_features(
                    duration_seconds=duration_seconds,
                    note="Audio too short for analysis (< 0.5s)."
                )

        except Exception as e:
            logger.warning(f"Failed to load audio: {e}")
            return self._empty_features(
                duration_seconds=0,
                note=f"Failed to load audio: {str(e)}"
            )

        # --- Speech/Silence segmentation ---
        speech_segments, silence_segments = self._segment_speech(y, sr)
        total_speech_time = sum(end - start for start, end in speech_segments)
        fluency_score = (total_speech_time / duration_seconds * 100) if duration_seconds > 0 else 0
        fluency_score = min(100.0, max(0.0, fluency_score))

        # --- Pause durations ---
        pause_durations_ms = [
            (end - start) * 1000 for start, end in silence_segments
            if (end - start) > 0.15  # Only count pauses > 150ms
        ]
        avg_pause_duration_ms = (
            sum(pause_durations_ms) / len(pause_durations_ms)
            if pause_durations_ms else 0.0
        )

        # --- Transcript via Vosk ---
        transcript = ""
        speech_rate_wpm = 0.0
        try:
            transcript = self._transcribe(audio_bytes, sr, language)
            if transcript:
                word_count = len(transcript.split())
                speech_time_minutes = total_speech_time / 60.0
                speech_rate_wpm = (
                    word_count / speech_time_minutes
                    if speech_time_minutes > 0 else 0.0
                )
            else:
                notes.append("Transcript empty — speech rate estimated from audio energy.")
                # Fallback: estimate speech rate from syllable-like energy peaks
                speech_rate_wpm = self._estimate_speech_rate_from_energy(y, sr)
        except Exception as e:
            logger.warning(f"Vosk transcription failed: {e}")
            notes.append(f"STT unavailable ({str(e)[:80]}). Speech rate estimated from audio energy.")
            speech_rate_wpm = self._estimate_speech_rate_from_energy(y, sr)

        return {
            "speech_rate_wpm": round(speech_rate_wpm, 1),
            "avg_pause_duration_ms": round(avg_pause_duration_ms, 1),
            "fluency_score": round(fluency_score, 1),
            "transcript": transcript[:2000],  # Cap transcript length
            "duration_seconds": round(duration_seconds, 2),
            "processing_note": " | ".join(notes) if notes else "",
        }

    def _segment_speech(
        self, y: np.ndarray, sr: int
    ) -> tuple[list[tuple[float, float]], list[tuple[float, float]]]:
        """
        Segment audio into speech and silence regions using RMS energy.

        Returns:
            (speech_segments, silence_segments) as lists of (start_sec, end_sec)
        """
        import librosa

        # Compute RMS energy in short frames
        frame_length = int(0.025 * sr)  # 25ms frames
        hop_length = int(0.010 * sr)    # 10ms hop

        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]

        # Dynamic threshold: use a fraction of the median non-zero RMS
        non_zero_rms = rms[rms > 0]
        if len(non_zero_rms) == 0:
            # Complete silence
            duration = len(y) / sr
            return [], [(0.0, duration)]

        threshold = np.median(non_zero_rms) * 0.3

        # Classify frames as speech or silence
        is_speech = rms > threshold

        # Convert frame indices to time
        times = librosa.frames_to_time(
            np.arange(len(rms)), sr=sr, hop_length=hop_length
        )

        # Group consecutive frames into segments
        speech_segments: list[tuple[float, float]] = []
        silence_segments: list[tuple[float, float]] = []

        current_is_speech = bool(is_speech[0])
        segment_start = times[0]

        for i in range(1, len(is_speech)):
            if bool(is_speech[i]) != current_is_speech:
                segment_end = times[i]
                if current_is_speech:
                    speech_segments.append((segment_start, segment_end))
                else:
                    silence_segments.append((segment_start, segment_end))
                segment_start = times[i]
                current_is_speech = bool(is_speech[i])

        # Close the last segment
        segment_end = times[-1] if len(times) > 0 else 0
        if current_is_speech:
            speech_segments.append((segment_start, segment_end))
        else:
            silence_segments.append((segment_start, segment_end))

        return speech_segments, silence_segments

    def _transcribe(self, audio_bytes: bytes, sample_rate: int, language: str) -> str:
        """
        Run Vosk speech-to-text on WAV audio bytes.

        Args:
            audio_bytes: WAV format audio
            sample_rate: Audio sample rate
            language: 'en' or 'kn'

        Returns:
            Transcribed text or empty string on failure.
        """
        from vosk import Model, KaldiRecognizer
        from app.core.config import get_settings

        settings = get_settings()
        model_path = (
            settings.vosk_model_path_en if language == "en"
            else settings.vosk_model_path_kn
        )

        # Cache the model in-process
        if language not in self._vosk_models:
            try:
                self._vosk_models[language] = Model(model_path)
                logger.info(f"Loaded Vosk model for '{language}' from {model_path}")
            except Exception as e:
                logger.warning(f"Failed to load Vosk model '{model_path}': {e}")
                raise RuntimeError(f"Vosk model not available for '{language}'") from e

        model = self._vosk_models[language]

        # Create recognizer
        recognizer = KaldiRecognizer(model, sample_rate)
        recognizer.SetWords(True)

        # Feed audio through the recognizer
        # We need to convert to 16-bit PCM mono at the target sample rate
        pcm_bytes = self._to_pcm16_mono(audio_bytes, sample_rate)

        # Process in chunks
        chunk_size = 4000
        for i in range(0, len(pcm_bytes), chunk_size):
            chunk = pcm_bytes[i:i + chunk_size]
            recognizer.AcceptWaveform(chunk)

        # Get final result
        result = json.loads(recognizer.FinalResult())
        return result.get("text", "")

    def _to_pcm16_mono(self, wav_bytes: bytes, target_sr: int) -> bytes:
        """Convert WAV bytes to raw 16-bit PCM mono at the target sample rate."""
        import soundfile as sf

        audio_buffer = io.BytesIO(wav_bytes)
        y, sr = sf.read(audio_buffer)

        # Convert to mono
        if len(y.shape) > 1:
            y = np.mean(y, axis=1)

        # Resample if needed
        if sr != target_sr:
            import librosa
            y = librosa.resample(y, orig_sr=sr, target_sr=target_sr)

        # Convert to 16-bit PCM
        pcm = (y * 32767).astype(np.int16)
        return pcm.tobytes()

    def _estimate_speech_rate_from_energy(self, y: np.ndarray, sr: int) -> float:
        """
        Fallback speech rate estimation when STT is unavailable.
        Counts energy peaks (syllable-like) per second and converts to WPM.
        Average English syllable rate: ~4 syllables/sec → ~150 WPM.
        """
        import librosa

        # Onset detection as a proxy for syllables
        onset_frames = librosa.onset.onset_detect(y=y, sr=sr, wait=4, delta=0.1)
        duration_seconds = len(y) / sr

        if duration_seconds < 1:
            return 0.0

        # Syllable rate to WPM: avg English word ≈ 1.5 syllables
        syllable_count = len(onset_frames)
        duration_minutes = duration_seconds / 60.0
        wpm_estimate = (syllable_count / 1.5) / duration_minutes if duration_minutes > 0 else 0.0

        return min(300.0, wpm_estimate)  # Cap at 300 WPM

    @staticmethod
    def _empty_features(duration_seconds: float = 0, note: str = "") -> dict:
        """Return a zeroed feature dict for edge cases."""
        return {
            "speech_rate_wpm": 0.0,
            "avg_pause_duration_ms": 0.0,
            "fluency_score": 0.0,
            "transcript": "",
            "duration_seconds": round(duration_seconds, 2),
            "processing_note": note,
        }

    @staticmethod
    def compute_score(features: dict) -> float:
        """
        Compute a behavioural speech score (0-100) from extracted features.

        Weighted scoring:
          - Fluency (40%): higher fluency = better
          - Speech rate (30%): moderate rate (120-180 WPM) = best
          - Pause pattern (30%): shorter average pauses = better
        """
        fluency = features.get("fluency_score", 0)
        speech_rate = features.get("speech_rate_wpm", 0)
        avg_pause = features.get("avg_pause_duration_ms", 0)

        # Fluency score: already 0-100
        fluency_component = fluency

        # Speech rate score: peak at 150 WPM, drops off on either side
        if speech_rate <= 0:
            rate_component = 0
        else:
            deviation = abs(speech_rate - 150) / 150
            rate_component = max(0, (1 - deviation) * 100)

        # Pause score: lower pauses = better, capped at 2000ms
        if avg_pause <= 0:
            pause_component = 100  # No pauses detected (could mean no speech though)
        else:
            pause_component = max(0, (1 - avg_pause / 2000) * 100)

        score = (
            fluency_component * 0.4 +
            rate_component * 0.3 +
            pause_component * 0.3
        )

        return round(min(100, max(0, score)), 1)


# Singleton instance
speech_processor = SpeechProcessor()
