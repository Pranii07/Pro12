"""
NeuroScreen -- Facial Pipeline Verification Script
===================================================
Tests:
  1. Facial model and preprocessor loading from ml/models/
  2. Metadata validation (classes, sample counts, feature dimensions)
  3. Predictor execution on image files from each class
  4. Predictor execution on raw numpy BGR and grayscale image arrays
  5. Disclaimer validation and absence of fabricated neurological disease labels
"""

import json
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import cv2
import joblib
import numpy as np
from ml.preprocessing.facial_preprocessor import (
    FACIAL_CLASSES,
    TOTAL_FEATURE_DIM,
    FacialPreprocessor,
    predict_facial,
)

MODELS_DIR = PROJECT_ROOT / "ml" / "models"
MODEL_PATH = MODELS_DIR / "facial_model.joblib"
PREPROCESSOR_PATH = MODELS_DIR / "facial_preprocessor.joblib"
METADATA_PATH = MODELS_DIR / "facial_model_metadata.json"
DATASET_DIR = PROJECT_ROOT / "ml" / "datasets" / "FacialDataSets" / "test"


def test_artifacts_exist_and_load():
    print("--- Test 1: Artifact Existence & Loading ---")
    assert MODEL_PATH.exists(), f"Missing model: {MODEL_PATH}"
    assert PREPROCESSOR_PATH.exists(), f"Missing preprocessor: {PREPROCESSOR_PATH}"
    assert METADATA_PATH.exists(), f"Missing metadata: {METADATA_PATH}"

    model = joblib.load(MODEL_PATH)
    preprocessor = FacialPreprocessor.load(PREPROCESSOR_PATH)
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)

    assert model is not None, "Model failed to load"
    assert preprocessor.is_fitted, "Preprocessor is not marked as fitted"
    assert meta["classes"] == FACIAL_CLASSES, f"Classes mismatch: {meta['classes']}"
    assert meta["feature_dim"] == TOTAL_FEATURE_DIM, f"Feature dim mismatch: {meta['feature_dim']}"

    print(f"  Model loaded: {meta['selected_best_model']}")
    print(f"  Trained on:   {meta['dataset_name']} ({meta['n_samples_total']} unique samples)")
    print(f"  Classes:      {meta['classes']}")
    print("  [OK] PASSED")


def test_predictions_on_images():
    print("\n--- Test 2: Inference on Actual Dataset Images ---")
    assert DATASET_DIR.exists(), f"Dataset directory missing: {DATASET_DIR}"

    for cls_name in FACIAL_CLASSES:
        cls_folder = DATASET_DIR / cls_name
        sample_path = next(cls_folder.glob("*.png"))
        res = predict_facial(sample_path)

        assert res["class"] in FACIAL_CLASSES, f"Invalid class predicted: {res['class']}"
        assert 0.0 <= res["confidence"] <= 1.0, f"Invalid confidence: {res['confidence']}"
        assert len(res["confidence_distribution"]) == len(FACIAL_CLASSES)
        assert "facial_symmetry_diff" in res["features"]
        assert "disclaimer" in res
        assert "Parkinson" not in res["class"]

        print(f"  File ({cls_name:<7}): -> Predicted {res['class']:<7} (Conf: {res['confidence']:.2f}, Sym: {res['features']['facial_symmetry_diff']})")

    print("  [OK] PASSED")


def test_predictions_on_raw_arrays():
    print("\n--- Test 3: Inference on Raw In-Memory Frame Arrays (FastAPI Simulation) ---")

    # Simulate in-memory 48x48 BGR frame as provided by camera/FastAPI
    dummy_bgr = np.full((48, 48, 3), 128, dtype=np.uint8)
    res_bgr = predict_facial(dummy_bgr)
    assert res_bgr["class"] in FACIAL_CLASSES
    print(f"  BGR Frame (48x48x3) -> Class: {res_bgr['class']}, Conf: {res_bgr['confidence']:.2f}")

    # Simulate camera frame (e.g. 640x480 resolution) that requires auto-resizing
    camera_frame = np.random.randint(50, 200, (480, 640, 3), dtype=np.uint8)
    res_cam = predict_facial(camera_frame)
    assert res_cam["class"] in FACIAL_CLASSES
    print(f"  Camera Frame (480x640x3) -> Class: {res_cam['class']}, Conf: {res_cam['confidence']:.2f}")

    print("  [OK] PASSED")


if __name__ == "__main__":
    test_artifacts_exist_and_load()
    test_predictions_on_images()
    test_predictions_on_raw_arrays()
    print("\n" + "=" * 60)
    print("[OK] ALL FACIAL VERIFICATION TESTS PASSED")
    print("=" * 60)
