"""
NeuroScreen -- Speech Pipeline Verification Script
===================================================
Tests:
  1. Speech model and preprocessor loading from ml/models/
  2. Metadata validation (classes, sample counts, feature dimensions)
  3. Predictor execution on actual audio files from Crema dataset
  4. Predictor execution on raw in-memory audio bytes (simulating FastAPI upload)
  5. Disclaimer validation and absence of fabricated neurological disease labels
"""

import json
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import joblib
import numpy as np
from ml.preprocessing.speech_preprocessor import (
    SPEECH_CLASSES,
    TOTAL_SPEECH_FEATURE_DIM,
    SpeechPreprocessor,
    predict_speech,
)

MODELS_DIR = PROJECT_ROOT / "ml" / "models"
MODEL_PATH = MODELS_DIR / "speech_model.joblib"
PREPROCESSOR_PATH = MODELS_DIR / "speech_preprocessor.joblib"
METADATA_PATH = MODELS_DIR / "speech_model_metadata.json"
DATASET_DIR = PROJECT_ROOT / "ml" / "datasets" / "SpeechDataSets" / "Crema"


def test_artifacts_exist_and_load():
    print("--- Test 1: Artifact Existence & Loading ---")
    assert MODEL_PATH.exists(), f"Missing model: {MODEL_PATH}"
    assert PREPROCESSOR_PATH.exists(), f"Missing preprocessor: {PREPROCESSOR_PATH}"
    assert METADATA_PATH.exists(), f"Missing metadata: {METADATA_PATH}"

    model = joblib.load(MODEL_PATH)
    preprocessor = SpeechPreprocessor.load(PREPROCESSOR_PATH)
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)

    assert model is not None, "Model failed to load"
    assert preprocessor.is_fitted, "Preprocessor is not marked as fitted"
    assert meta["classes"] == SPEECH_CLASSES, f"Classes mismatch: {meta['classes']}"
    assert meta["feature_dim"] == TOTAL_SPEECH_FEATURE_DIM, f"Feature dim mismatch: {meta['feature_dim']}"

    print(f"  Model loaded: {meta['selected_best_model']}")
    print(f"  Trained on:   {meta['dataset_name']} ({meta['n_samples_total']} samples across {meta['n_train_speakers'] + meta['n_test_speakers']} speakers)")
    print(f"  Classes:      {meta['classes']}")
    print("  [OK] PASSED")


def test_predictions_on_audio_files():
    print("\n--- Test 2: Inference on Actual Audio Files ---")
    assert DATASET_DIR.exists(), f"Dataset directory missing: {DATASET_DIR}"

    for emo_code, emo_name in [("ANG", "Angry"), ("HAP", "Happy"), ("NEU", "Neutral"), ("SAD", "Sad")]:
        sample_path = next(DATASET_DIR.glob(f"*_{emo_code}_*.wav"))
        res = predict_speech(sample_path)

        assert res["class"] in SPEECH_CLASSES, f"Invalid class predicted: {res['class']}"
        assert 0.0 <= res["confidence"] <= 1.0, f"Invalid confidence: {res['confidence']}"
        assert len(res["confidence_distribution"]) == len(SPEECH_CLASSES)
        assert "pitch_f0_mean_hz" in res["features"]
        assert "jitter" in res["features"]
        assert "shimmer" in res["features"]
        assert "disclaimer" in res
        assert "Parkinson" not in res["class"]

        print(f"  File ({emo_name:<7}): -> Predicted {res['class']:<7} (Conf: {res['confidence']:.2f}, Pitch: {res['features']['pitch_f0_mean_hz']}Hz, Jitter: {res['features']['jitter']})")

    print("  [OK] PASSED")


def test_predictions_on_raw_bytes():
    print("\n--- Test 3: Inference on Raw In-Memory Audio Bytes (FastAPI Simulation) ---")
    sample_file = next(DATASET_DIR.glob("*.wav"))
    with open(sample_file, "rb") as fp:
        raw_bytes = fp.read()

    res = predict_speech(raw_bytes)
    assert res["class"] in SPEECH_CLASSES
    assert res["features"]["duration_seconds"] > 0
    print(f"  Raw Bytes ({len(raw_bytes):,} bytes) -> Class: {res['class']}, Conf: {res['confidence']:.2f}, Duration: {res['features']['duration_seconds']}s")
    print("  [OK] PASSED")


if __name__ == "__main__":
    test_artifacts_exist_and_load()
    test_predictions_on_audio_files()
    test_predictions_on_raw_bytes()
    print("\n" + "=" * 60)
    print("[OK] ALL SPEECH VERIFICATION TESTS PASSED")
    print("=" * 60)
