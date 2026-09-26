"""
NeuroScreen -- Speech Dynamics & Acoustic Preprocessing Pipeline
=================================================================
Handles audio validation, acoustic feature extraction, speaker grouping,
and normalization for the speech-analysis component.

Trained and validated on real speech acoustic benchmark data (SpeechDataSets/Crema).
Extracts 41 explainable acoustic features:
  - 13 MFCC means (mfcc_1_mean to mfcc_13_mean)
  - 13 MFCC standard deviations (mfcc_1_std to mfcc_13_std)
  - Spectral Centroid (mean & std): vocal brightness and timbre
  - Spectral Bandwidth (mean & std): frequency spread
  - Spectral Rolloff (mean & std): high-frequency decay
  - Zero Crossing Rate: voiced vs unvoiced speech ratio
  - RMS Energy (mean & std): vocal amplitude and loudness dynamics
  - Fundamental Frequency / Pitch F0 (mean & std): intonation and pitch stability
  - Jitter: cycle-to-cycle frequency perturbation (vocal tremor / stability)
  - Shimmer: cycle-to-cycle amplitude perturbation (amplitude stability)
  - Silence Ratio: pause and silence percentage
  - Duration: speech segment duration in seconds

IMPORTANT ETHICAL & CLINICAL NOTICE:
------------------------------------
This pipeline and its models measure vocal acoustics, speech dynamics, and
affective prosody. They are part of an educational/research prototype.
Acoustic emotion labels (Angry, Disgust, Fear, Happy, Neutral, Sad) reflect
vocal prosodic states and must NOT be construed as clinical diagnoses of
Parkinson's disease or any other neurological disorder.
"""

from __future__ import annotations

import io
import json
import logging
from pathlib import Path
from typing import Any, Optional, Union

import joblib
import numpy as np
import scipy.fftpack
import scipy.signal
import soundfile as sf
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger("neuroscreen.speech.preprocessing")

# -------------------------------------------------------
# Classes & Feature Definitions
# -------------------------------------------------------

SPEECH_CLASSES = ["Angry", "Disgust", "Fear", "Happy", "Neutral", "Sad"]

SPEECH_EMOTION_MAP = {
    "ANG": "Angry",
    "DIS": "Disgust",
    "FEA": "Fear",
    "HAP": "Happy",
    "NEU": "Neutral",
    "SAD": "Sad",
}

ACOUSTIC_FEATURE_NAMES = [
    # MFCC Means (1-13)
    *[f"mfcc_{i}_mean" for i in range(1, 14)],
    # MFCC Stds (1-13)
    *[f"mfcc_{i}_std" for i in range(1, 14)],
    # Spectral
    "spectral_centroid_mean",
    "spectral_centroid_std",
    "spectral_bandwidth_mean",
    "spectral_bandwidth_std",
    "spectral_rolloff_mean",
    "spectral_rolloff_std",
    "zero_crossing_rate",
    # Energy
    "rms_energy_mean",
    "rms_energy_std",
    # Pitch & Voice Quality
    "pitch_f0_mean",
    "pitch_f0_std",
    "jitter",
    "shimmer",
    # Temporal & Fluency
    "silence_ratio",
    "duration_seconds",
]

TOTAL_SPEECH_FEATURE_DIM = len(ACOUSTIC_FEATURE_NAMES)  # 41 features


class SpeechPreprocessor:
    """
    Preprocessing pipeline for speech audio files and acoustic feature extraction.

    Responsibilities:
      1. Load and validate WAV audio files or in-memory audio bytes.
      2. Standardize audio to mono and float32.
      3. Extract 41 explainable acoustic features using fast SciPy signal processing.
      4. Standardize numeric features using StandardScaler.
      5. Serialize and deserialize fitted preprocessing artifacts.
    """

    def __init__(self):
        self.scaler: Optional[StandardScaler] = None
        self.classes: list[str] = list(SPEECH_CLASSES)
        self.feature_names: list[str] = list(ACOUSTIC_FEATURE_NAMES)
        self.is_fitted: bool = False

    @staticmethod
    def extract_audio_features(
        audio_input: Union[str, Path, bytes, np.ndarray],
        sr: Optional[int] = None,
    ) -> np.ndarray:
        """
        Extract the 41-dimensional acoustic feature vector from an audio source.

        Args:
            audio_input: File path, raw WAV bytes, or decoded 1D numpy array.
            sr: Sampling rate (required if audio_input is a numpy array).

        Returns:
            1D numpy array of shape (41,) containing acoustic features.
        """
        if isinstance(audio_input, (str, Path)):
            y, sr = sf.read(str(audio_input))
        elif isinstance(audio_input, bytes):
            buffer = io.BytesIO(audio_input)
            y, sr = sf.read(buffer)
        elif isinstance(audio_input, np.ndarray):
            y = audio_input
            if sr is None:
                sr = 16000
        else:
            raise TypeError(f"Unsupported audio input type: {type(audio_input)}")

        # Convert to mono if stereo
        if y.ndim > 1:
            y = np.mean(y, axis=1)

        y = y.astype(np.float32)
        duration = float(len(y) / sr)

        if duration < 0.2:
            return np.zeros(TOTAL_SPEECH_FEATURE_DIM, dtype=np.float32)

        # 1. SciPy STFT (nperseg=512, hop=256)
        nperseg = 512
        f, t_s, Zxx = scipy.signal.stft(y, fs=sr, nperseg=nperseg, noverlap=256)
        mag = np.abs(Zxx) + 1e-10
        power = mag ** 2

        # 2. Spectral Centroid
        denom = np.sum(power, axis=0)
        cent = np.sum(f[:, None] * power, axis=0) / denom

        # 3. Spectral Bandwidth
        bw = np.sqrt(np.sum(((f[:, None] - cent[None, :]) ** 2) * power, axis=0) / denom)

        # 4. Spectral Rolloff (85% cumulative energy)
        cum_energy = np.cumsum(power, axis=0)
        tot_energy = cum_energy[-1, :]
        thresh = 0.85 * tot_energy
        rolloff_idx = np.argmax(cum_energy >= thresh, axis=0)
        rolloff = f[rolloff_idx]

        # 5. RMS Energy & Zero Crossing Rate
        rms = np.sqrt(np.mean(power, axis=0))
        zcr = float(np.mean(np.abs(np.diff(np.sign(y)))) / 2.0)

        # 6. MFCCs via Mel Filterbank & DCT
        n_mels = 20
        mel_pts = np.linspace(0, 2595 * np.log10(1 + (sr / 2) / 700), n_mels + 2)
        hz_pts = 700 * (10 ** (mel_pts / 2595) - 1)
        bin_pts = np.floor((nperseg + 1) * hz_pts / sr).astype(int)
        fbank = np.zeros((n_mels, int(nperseg / 2 + 1)), dtype=np.float32)
        for m in range(1, n_mels + 1):
            for k in range(bin_pts[m - 1], bin_pts[m]):
                fbank[m - 1, k] = (k - bin_pts[m - 1]) / max(1, (bin_pts[m] - bin_pts[m - 1]))
            for k in range(bin_pts[m], bin_pts[m + 1]):
                fbank[m - 1, k] = (bin_pts[m + 1] - k) / max(1, (bin_pts[m + 1] - bin_pts[m]))

        mel_energy = np.dot(fbank, power)
        mfcc = scipy.fftpack.dct(np.log(mel_energy + 1e-10), type=2, axis=0, norm="ortho")[:13]
        mfcc_mean = np.mean(mfcc, axis=1)
        mfcc_std = np.std(mfcc, axis=1)

        # 7. Autocorrelation Pitch (F0), Jitter, and Shimmer
        frame_len = int(0.03 * sr)
        hop_len = int(0.015 * sr)
        min_lag = int(sr / 400)
        max_lag = int(sr / 60)
        f0_list = []
        amp_list = []

        for i in range(0, len(y) - frame_len, hop_len):
            frame = y[i : i + frame_len]
            amp_list.append(float(np.max(np.abs(frame))))
            corr = np.correlate(frame, frame, mode="full")[frame_len - 1 :]
            if len(corr) > max_lag:
                peak = min_lag + np.argmax(corr[min_lag:max_lag])
                if corr[peak] > 0.35 * corr[0]:
                    f0_list.append(float(sr / peak))

        pitch_mean = float(np.mean(f0_list)) if f0_list else 0.0
        pitch_std = float(np.std(f0_list)) if f0_list else 0.0

        # Jitter (relative average perturbation in fundamental period)
        if len(f0_list) > 1:
            periods = 1.0 / np.array(f0_list)
            jitter = float(np.mean(np.abs(np.diff(periods))) / max(1e-6, np.mean(periods)))
        else:
            jitter = 0.0

        # Shimmer (relative average perturbation in peak amplitude)
        if len(amp_list) > 1 and np.mean(amp_list) > 1e-4:
            shimmer = float(np.mean(np.abs(np.diff(amp_list))) / np.mean(amp_list))
        else:
            shimmer = 0.0

        # Silence Ratio
        thresh_silence = 0.05 * np.max(rms) if np.max(rms) > 0 else 0.001
        silence_ratio = float(np.mean(rms < thresh_silence)) if len(rms) > 0 else 0.0

        feature_vector = np.hstack([
            mfcc_mean,
            mfcc_std,
            [
                float(np.mean(cent)),
                float(np.std(cent)),
                float(np.mean(bw)),
                float(np.std(bw)),
                float(np.mean(rolloff)),
                float(np.std(rolloff)),
                zcr,
                float(np.mean(rms)),
                float(np.std(rms)),
                pitch_mean,
                pitch_std,
                jitter,
                shimmer,
                silence_ratio,
                duration,
            ],
        ])

        return feature_vector.astype(np.float32)

    @classmethod
    def load_crema_dataset(
        cls, dataset_dir: Union[str, Path], max_samples: Optional[int] = None
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[str], dict[str, Any]]:
        """
        Load, validate, and extract features from CREMA-D dataset.

        Returns:
            X: 2D numpy array of shape (N, 41)
            y: 1D numpy array of class indices (0 to 5)
            groups: 1D numpy array of speaker IDs for group splitting
            file_paths: list of audio file paths
            stats: summary dictionary
        """
        dataset_dir = Path(dataset_dir)
        preprocessor = cls()
        files = sorted(list(dataset_dir.glob("*.wav")))

        if max_samples and max_samples < len(files):
            # Select deterministic subset preserving class balance
            np.random.seed(42)
            indices = np.random.choice(len(files), max_samples, replace=False)
            files = [files[i] for i in sorted(indices)]

        X_list = []
        y_list = []
        groups_list = []
        file_paths = []
        corrupted = 0
        durations = []

        class_counts = {c: 0 for c in SPEECH_CLASSES}
        speakers_set = set()

        emo_to_idx = {name: idx for idx, name in enumerate(SPEECH_CLASSES)}

        for fp in files:
            parts = fp.stem.split("_")
            if len(parts) < 3:
                continue

            spk_id = parts[0]
            emo_code = parts[2]
            if emo_code not in SPEECH_EMOTION_MAP:
                continue

            emo_name = SPEECH_EMOTION_MAP[emo_code]
            label_idx = emo_to_idx[emo_name]

            try:
                feats = preprocessor.extract_audio_features(fp)
                X_list.append(feats)
                y_list.append(label_idx)
                groups_list.append(spk_id)
                file_paths.append(str(fp))
                class_counts[emo_name] += 1
                speakers_set.add(spk_id)
                durations.append(feats[-1])  # Last feature is duration
            except Exception as e:
                corrupted += 1
                logger.warning(f"Error loading {fp}: {e}")

        X = np.array(X_list, dtype=np.float32)
        y = np.array(y_list, dtype=np.int64)
        groups = np.array(groups_list)

        stats = {
            "total_samples": len(X),
            "speakers_count": len(speakers_set),
            "corrupted_count": corrupted,
            "classes": SPEECH_CLASSES,
            "class_distribution": class_counts,
            "mean_duration_seconds": round(float(np.mean(durations)), 2) if durations else 0.0,
            "feature_dim": X.shape[1] if len(X) > 0 else 0,
        }

        return X, y, groups, file_paths, stats

    def fit(self, X: np.ndarray, y: Optional[np.ndarray] = None) -> "SpeechPreprocessor":
        """Fit StandardScaler on acoustic feature matrix."""
        self.scaler = StandardScaler()
        self.scaler.fit(X)
        self.is_fitted = True
        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        """Standardize feature matrix using fitted scaler."""
        if not self.is_fitted or self.scaler is None:
            raise RuntimeError("SpeechPreprocessor is not fitted. Call fit() first.")
        if X.ndim == 1:
            X = X.reshape(1, -1)
        return self.scaler.transform(X)

    def fit_transform(self, X: np.ndarray, y: Optional[np.ndarray] = None) -> np.ndarray:
        """Fit and transform in a single pass."""
        self.fit(X, y)
        return self.transform(X)

    def save(self, filepath: Union[str, Path]) -> None:
        """Serialize fitted preprocessor to disk using joblib."""
        if not self.is_fitted:
            raise RuntimeError("Cannot save unfitted preprocessor.")
        data = {
            "scaler": self.scaler,
            "classes": self.classes,
            "feature_names": self.feature_names,
            "total_feature_dim": TOTAL_SPEECH_FEATURE_DIM,
            "version": "1.0.0",
        }
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(data, filepath)
        logger.info(f"SpeechPreprocessor saved to {filepath}")

    @classmethod
    def load(cls, filepath: Union[str, Path]) -> "SpeechPreprocessor":
        """Deserialize fitted preprocessor from disk."""
        data = joblib.load(filepath)
        instance = cls()
        instance.scaler = data["scaler"]
        instance.classes = data.get("classes", SPEECH_CLASSES)
        instance.feature_names = data.get("feature_names", ACOUSTIC_FEATURE_NAMES)
        instance.is_fitted = True
        return instance


# -------------------------------------------------------
# Reusable Application Prediction Function
# -------------------------------------------------------

_CACHED_SPEECH_MODEL = None
_CACHED_SPEECH_PREPROCESSOR = None


def predict_speech(
    audio_or_features: Union[str, Path, bytes, np.ndarray, dict[str, float]],
    model: Optional[Any] = None,
    preprocessor: Optional[SpeechPreprocessor] = None,
    models_dir: Optional[Union[str, Path]] = None,
) -> dict[str, Any]:
    """
    Reusable prediction function that accepts audio input (file path, raw bytes,
    or decoded numpy array) or pre-extracted feature vector and produces a
    structured acoustic screening evaluation.

    Args:
        audio_or_features: Audio file path, raw WAV bytes, decoded 1D numpy array,
                           or 41-element acoustic feature vector.
        model: Optional pre-loaded classifier. If None, loaded from disk.
        preprocessor: Optional pre-loaded SpeechPreprocessor.
        models_dir: Optional path to directory containing model joblib files.

    Returns:
        Structured result dict:
            - class: str (Predicted vocal affective state: "Angry", "Disgust", "Fear", "Happy", "Neutral", "Sad")
            - confidence: float (0.0 to 1.0)
            - confidence_distribution: dict mapping each class to its probability
            - features: dict with key acoustic metrics (pitch_f0_mean, pitch_f0_std, jitter, shimmer, silence_ratio, duration_seconds)
            - model_name: str
            - disclaimer: ethical / clinical research notice
    """
    global _CACHED_SPEECH_MODEL, _CACHED_SPEECH_PREPROCESSOR

    if models_dir is None:
        project_root = Path(__file__).resolve().parent.parent.parent
        models_dir = project_root / "ml" / "models"
    else:
        models_dir = Path(models_dir)

    # Load artifacts if not provided
    if preprocessor is None:
        if _CACHED_SPEECH_PREPROCESSOR is None:
            pp_path = models_dir / "speech_preprocessor.joblib"
            if not pp_path.exists():
                raise FileNotFoundError(f"Speech preprocessor not found at {pp_path}. Run training first.")
            _CACHED_SPEECH_PREPROCESSOR = SpeechPreprocessor.load(pp_path)
        preprocessor = _CACHED_SPEECH_PREPROCESSOR

    if model is None:
        if _CACHED_SPEECH_MODEL is None:
            m_path = models_dir / "speech_model.joblib"
            if not m_path.exists():
                raise FileNotFoundError(f"Speech model not found at {m_path}. Run training first.")
            _CACHED_SPEECH_MODEL = joblib.load(m_path)
        model = _CACHED_SPEECH_MODEL

    # Extract features if audio provided
    if isinstance(audio_or_features, np.ndarray) and audio_or_features.ndim == 1 and len(audio_or_features) == TOTAL_SPEECH_FEATURE_DIM:
        raw_features = audio_or_features
    elif isinstance(audio_or_features, dict):
        raw_features = np.array([audio_or_features.get(k, 0.0) for k in ACOUSTIC_FEATURE_NAMES], dtype=np.float32)
    else:
        raw_features = preprocessor.extract_audio_features(audio_or_features)

    # Standardize
    X_scaled = preprocessor.transform(raw_features)

    # Model inference
    pred_idx = int(model.predict(X_scaled)[0])
    predicted_class = preprocessor.classes[pred_idx]

    # Confidence distribution
    if hasattr(model, "predict_proba"):
        probas = model.predict_proba(X_scaled)[0]
        confidence_dist = {cls_name: round(float(probas[i]), 4) for i, cls_name in enumerate(preprocessor.classes)}
        confidence = float(probas[pred_idx])
    else:
        confidence_dist = {cls_name: 1.0 if cls_name == predicted_class else 0.0 for cls_name in preprocessor.classes}
        confidence = 1.0

    # Extract key vocal metrics for audit/interpretability
    # Indices: pitch_f0_mean (35), pitch_f0_std (36), jitter (37), shimmer (38), silence_ratio (39), duration (40)
    features_summary = {
        "pitch_f0_mean_hz": round(float(raw_features[35]), 1),
        "pitch_f0_std_hz": round(float(raw_features[36]), 1),
        "jitter": round(float(raw_features[37]), 4),
        "shimmer": round(float(raw_features[38]), 4),
        "silence_ratio": round(float(raw_features[39]), 3),
        "duration_seconds": round(float(raw_features[40]), 2),
    }

    return {
        "class": predicted_class,
        "confidence": round(confidence, 4),
        "confidence_distribution": confidence_dist,
        "features": features_summary,
        "model_name": type(model).__name__,
        "disclaimer": (
            "This application is intended for behavioural screening and educational/research "
            "purposes only. It is NOT a medical diagnosis and cannot replace evaluation by a "
            "qualified healthcare professional."
        ),
    }
