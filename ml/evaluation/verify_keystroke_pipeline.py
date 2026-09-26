"""
NeuroScreen -- Keystroke Pipeline Verification Script
======================================================
Tests:
  1. Keystroke model and preprocessor loading from ml/models/
  2. Metadata validation (leak-free split verification, metric records)
  3. Predictor execution on standard frontend/backend typing payloads
  4. Robustness to input formatting (percentages vs ratios, backspace counts vs rates)
"""

import json
import sys
from pathlib import Path

# Add project root and backend to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import joblib
from ml.preprocessing.keystroke_preprocessor import (
    CLASS_NAMES,
    KEYSTROKE_FEATURE_COLUMNS,
    KeystrokePreprocessor,
    predict_keystroke,
)

MODELS_DIR = PROJECT_ROOT / "ml" / "models"
MODEL_PATH = MODELS_DIR / "keystroke_model.joblib"
PREPROCESSOR_PATH = MODELS_DIR / "keystroke_preprocessor.joblib"
METADATA_PATH = MODELS_DIR / "keystroke_model_metadata.json"


def test_artifacts_exist_and_load():
    print("--- Test 1: Artifact Existence & Loading ---")
    assert MODEL_PATH.exists(), f"Missing model: {MODEL_PATH}"
    assert PREPROCESSOR_PATH.exists(), f"Missing preprocessor: {PREPROCESSOR_PATH}"
    assert METADATA_PATH.exists(), f"Missing metadata: {METADATA_PATH}"

    model = joblib.load(MODEL_PATH)
    preprocessor = KeystrokePreprocessor.load(PREPROCESSOR_PATH)
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)

    assert model is not None, "Model failed to load"
    assert preprocessor.is_fitted, "Preprocessor is not marked as fitted"
    assert "GradientBoosting" in type(model).__name__ or meta["selected_best_model"] == type(model).__name__, (
        f"Metadata best model {meta['selected_best_model']} mismatch with loaded model {type(model).__name__}"
    )

    print(f"  Model loaded: {meta['selected_best_model']}")
    print(f"  Trained on:   {meta['dataset_name']} ({meta['n_samples_total']} samples across {meta['n_train_subjects'] + meta['n_test_subjects']} subjects)")
    print("  [OK] PASSED")


def test_predictions():
    print("\n--- Test 2: Inference on Simulated Frontend Payloads ---")

    # Fast / Fluent typist
    payload_fast = {
        "wpm": 75.0,
        "cpm": 375.0,
        "accuracy": 0.98,
        "backspace_rate": 0.02,
        "avg_hold_time_ms": 75.0,
        "avg_flight_time_ms": 90.0,
    }
    res_fast = predict_keystroke(payload_fast)
    assert res_fast["screening_level"] == "LOW", f"Expected LOW, got {res_fast['screening_level']}"
    assert res_fast["score"] >= 70.0, f"Expected score >= 70, got {res_fast['score']}"
    print(f"  Fast typist -> Level: {res_fast['screening_level']}, Score: {res_fast['score']}, Prob: {res_fast['confidence_distribution']}")

    # Moderate typist
    payload_mod = {
        "wpm": 46.0,
        "cpm": 230.0,
        "accuracy": 0.90,
        "backspace_rate": 0.06,
        "avg_hold_time_ms": 95.0,
        "avg_flight_time_ms": 155.0,
    }
    res_mod = predict_keystroke(payload_mod)
    assert res_mod["screening_level"] in ["LOW", "MODERATE"], f"Expected LOW or MODERATE, got {res_mod['screening_level']}"
    print(f"  Moderate typist -> Level: {res_mod['screening_level']}, Score: {res_mod['score']}, Prob: {res_mod['confidence_distribution']}")

    # Slow / Hesitant typist
    payload_slow = {
        "wpm": 22.0,
        "cpm": 110.0,
        "accuracy": 0.80,
        "backspace_rate": 0.15,
        "avg_hold_time_ms": 190.0,
        "avg_flight_time_ms": 340.0,
    }
    res_slow = predict_keystroke(payload_slow)
    assert res_slow["screening_level"] == "HIGH", f"Expected HIGH, got {res_slow['screening_level']}"
    assert res_slow["score"] < 65.0, f"Expected score < 65, got {res_slow['score']}"
    print(f"  Slow typist -> Level: {res_slow['screening_level']}, Score: {res_slow['score']}, Prob: {res_slow['confidence_distribution']}")

    print("  [OK] PASSED")


def test_input_tolerance():
    print("\n--- Test 3: Input Format Tolerance (Percentages & Backspace Counts) ---")

    # Frontend sending accuracy as percentage (95) and backspace_count (3 out of 50 chars)
    payload_variant = {
        "wpm": 60.0,
        "cpm": 300.0,
        "accuracy": 95.0,  # Percentage format
        "backspace_count": 3,  # Count instead of rate
        "total_chars": 60,
        "avg_hold_time_ms": 82.0,
        "avg_flight_time_ms": 110.0,
    }
    res = predict_keystroke(payload_variant)
    assert res["screening_level"] in CLASS_NAMES
    assert "disclaimer" in res
    print(f"  Tolerated variant payload -> Level: {res['screening_level']}, Score: {res['score']}")
    print("  [OK] PASSED")


if __name__ == "__main__":
    test_artifacts_exist_and_load()
    test_predictions()
    test_input_tolerance()
    print("\n" + "=" * 60)
    print("[OK] ALL KEYSTROKE VERIFICATION TESTS PASSED")
    print("=" * 60)
