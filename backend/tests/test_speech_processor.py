"""
NeuroScreen — Speech Processor Unit Tests
============================================
Tests for the speech feature extraction service.

These tests use deterministic inputs (known feature dicts, synthetic
audio arrays) so they don't require Vosk models or real audio files.
"""

import pytest
import numpy as np


class TestSpeechProcessorScore:
    """Test SpeechProcessor.compute_score() with known inputs."""

    def test_perfect_score(self):
        """High fluency + ideal speech rate + no pauses → score near 100."""
        from app.services.speech_processor import SpeechProcessor

        features = {
            "speech_rate_wpm": 150,       # Ideal rate
            "avg_pause_duration_ms": 0,   # No pauses
            "fluency_score": 100,         # Perfect fluency
        }
        score = SpeechProcessor.compute_score(features)
        assert 90 <= score <= 100, f"Expected near-perfect score, got {score}"

    def test_zero_score(self):
        """No speech rate, no fluency → score 0 (with pause component at 100 because 0 pauses)."""
        from app.services.speech_processor import SpeechProcessor

        features = {
            "speech_rate_wpm": 0,
            "avg_pause_duration_ms": 0,
            "fluency_score": 0,
        }
        score = SpeechProcessor.compute_score(features)
        # fluency=0*0.4=0, rate=0*0.3=0, pause=100*0.3=30
        assert score == 30.0, f"Expected 30.0, got {score}"

    def test_moderate_score(self):
        """Moderate fluency + moderate rate + some pauses → mid-range score."""
        from app.services.speech_processor import SpeechProcessor

        features = {
            "speech_rate_wpm": 120,        # Slightly below ideal
            "avg_pause_duration_ms": 500,  # Half-second pauses
            "fluency_score": 60,           # 60% fluency
        }
        score = SpeechProcessor.compute_score(features)
        assert 40 <= score <= 80, f"Expected mid-range score, got {score}"

    def test_very_slow_speech(self):
        """Very slow speech rate penalised."""
        from app.services.speech_processor import SpeechProcessor

        features = {
            "speech_rate_wpm": 30,
            "avg_pause_duration_ms": 1500,
            "fluency_score": 20,
        }
        score = SpeechProcessor.compute_score(features)
        assert score < 30, f"Expected low score for very slow speech, got {score}"

    def test_very_fast_speech(self):
        """Very fast speech rate (>250 WPM) penalised."""
        from app.services.speech_processor import SpeechProcessor

        features = {
            "speech_rate_wpm": 280,
            "avg_pause_duration_ms": 100,
            "fluency_score": 80,
        }
        score = SpeechProcessor.compute_score(features)
        assert score < 70, f"Expected penalised score for very fast speech, got {score}"

    def test_score_clamped_to_0_100(self):
        """Score is always clamped to [0, 100]."""
        from app.services.speech_processor import SpeechProcessor

        features = {
            "speech_rate_wpm": 150,
            "avg_pause_duration_ms": 0,
            "fluency_score": 100,
        }
        score = SpeechProcessor.compute_score(features)
        assert 0 <= score <= 100

    def test_missing_keys_default_to_zero(self):
        """Missing keys use .get() default of 0 — should not crash."""
        from app.services.speech_processor import SpeechProcessor

        score = SpeechProcessor.compute_score({})
        assert 0 <= score <= 100


class TestSpeechProcessorEmptyFeatures:
    """Test _empty_features() factory method."""

    def test_returns_correct_keys(self):
        from app.services.speech_processor import SpeechProcessor

        features = SpeechProcessor._empty_features(duration_seconds=5.0, note="test")
        assert features["speech_rate_wpm"] == 0.0
        assert features["avg_pause_duration_ms"] == 0.0
        assert features["fluency_score"] == 0.0
        assert features["transcript"] == ""
        assert features["duration_seconds"] == 5.0
        assert features["processing_note"] == "test"

    def test_default_values(self):
        from app.services.speech_processor import SpeechProcessor

        features = SpeechProcessor._empty_features()
        assert features["duration_seconds"] == 0
        assert features["processing_note"] == ""


class TestSpeechSegmentation:
    """Test _segment_speech() with synthetic audio."""

    def test_pure_silence(self):
        """All-zeros array → no speech segments."""
        from app.services.speech_processor import SpeechProcessor

        processor = SpeechProcessor()
        y = np.zeros(16000, dtype=np.float32)  # 1 second of silence at 16kHz
        speech, silence = processor._segment_speech(y, 16000)
        assert len(speech) == 0 or sum(e - s for s, e in speech) < 0.1

    def test_pure_tone(self):
        """Continuous sine wave → mostly speech segments."""
        from app.services.speech_processor import SpeechProcessor

        processor = SpeechProcessor()
        sr = 16000
        t = np.linspace(0, 1, sr, dtype=np.float32)
        y = 0.5 * np.sin(2 * np.pi * 440 * t)  # 440Hz tone for 1 second
        speech, silence = processor._segment_speech(y, sr)
        total_speech = sum(e - s for s, e in speech)
        assert total_speech > 0.5, f"Expected mostly speech, got {total_speech}s"


class TestSpeechRateEstimation:
    """Test _estimate_speech_rate_from_energy() with synthetic signals."""

    def test_silent_audio(self):
        """Silent audio → 0 WPM."""
        from app.services.speech_processor import SpeechProcessor

        processor = SpeechProcessor()
        y = np.zeros(16000 * 5, dtype=np.float32)  # 5 seconds silence
        wpm = processor._estimate_speech_rate_from_energy(y, 16000)
        assert wpm == 0.0

    def test_short_audio(self):
        """Audio shorter than 1 second → 0 WPM."""
        from app.services.speech_processor import SpeechProcessor

        processor = SpeechProcessor()
        y = np.zeros(8000, dtype=np.float32)  # 0.5 seconds
        wpm = processor._estimate_speech_rate_from_energy(y, 16000)
        assert wpm == 0.0

    def test_capped_at_300(self):
        """WPM is capped at 300."""
        from app.services.speech_processor import SpeechProcessor

        processor = SpeechProcessor()
        # Generate a rapid-onset signal to produce many onsets
        sr = 16000
        duration = 2  # seconds
        t = np.linspace(0, duration, sr * duration, dtype=np.float32)
        # Create rapid clicks (many onsets) every 0.01 seconds
        y = np.zeros_like(t)
        for i in range(0, len(t), 160):  # Every 10ms
            y[i:i+80] = 0.9
        wpm = processor._estimate_speech_rate_from_energy(y, sr)
        assert wpm <= 300.0
