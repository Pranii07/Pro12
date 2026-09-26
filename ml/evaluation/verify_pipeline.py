"""
Quick verification script for the ML pipeline.
Tests: model loading, preprocessing, prediction.
"""
import sys
import json
from pathlib import Path

# Add project root + backend to path
# verify_pipeline.py is at ml/evaluation/, so project root is 2 parents up from ml/
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(BACKEND_DIR))

from app.ml.model_loader import init_model_loader, get_model_loader
from app.ml.predictor import predict_screening

MODEL_PATH = PROJECT_ROOT / "ml" / "models" / "best_model.joblib"
PREPROCESSOR_PATH = PROJECT_ROOT / "ml" / "models" / "preprocessor.joblib"
METADATA_PATH = PROJECT_ROOT / "ml" / "models" / "model_metadata.json"


def test_model_loading():
    print("--- Test 1: Model Loading ---")
    success = init_model_loader(MODEL_PATH, PREPROCESSOR_PATH, METADATA_PATH)
    assert success, "Model loading failed!"
    
    loader = get_model_loader()
    assert loader.is_loaded, "Loader reports not loaded"
    assert loader.model is not None, "Model is None"
    assert loader.preprocessor is not None, "Preprocessor is None"
    assert loader.metadata.get("model_name"), "No model name in metadata"
    
    print(f"  Model: {loader.metadata['model_name']} v{loader.metadata['model_version']}")
    print("  PASSED")


def test_prediction_all_modules():
    print("\n--- Test 2: Prediction (all modules) ---")
    result = predict_screening({
        "typing": {
            "wpm": 55, "cpm": 275, "accuracy": 0.92,
            "backspace_rate": 0.06, "avg_hold_time_ms": 90,
            "avg_flight_time_ms": 120,
        },
        "memory": {
            "word_recall_accuracy": 0.85, "number_recall_accuracy": 0.80,
            "pattern_accuracy": 0.88, "avg_response_time_ms": 1400,
        },
        "reaction": {
            "avg_reaction_time_ms": 300, "fastest_reaction_ms": 200,
            "slowest_reaction_ms": 480, "false_start_count": 1,
        },
        "speech": {
            "speech_rate_wpm": 130, "avg_pause_duration_ms": 280,
            "fluency_score": 0.85, "transcript_word_count": 75,
        },
        "facial": {
            "blink_rate_per_min": 16, "avg_head_movement": 3.0,
            "orientation_stability": 0.88, "attention_score": 0.86,
        },
    })

    assert "screening_level" in result
    assert result["screening_level"] in ["LOW", "MODERATE", "HIGH"]
    assert "model_distribution" in result
    assert "overall_score" in result
    assert all(v for v in result["modalities_present"].values()), "All modules should be present"

    print(f"  Screening Level: {result['screening_level']}")
    print(f"  Overall Score: {result['overall_score']}")
    print(f"  Distribution: {result['model_distribution']}")
    print(f"  Modalities: {result['modalities_present']}")
    print("  PASSED")


def test_prediction_partial_modules():
    print("\n--- Test 3: Prediction (partial — typing + reaction only) ---")
    result = predict_screening({
        "typing": {
            "wpm": 30, "cpm": 150, "accuracy": 0.75,
            "backspace_rate": 0.18, "avg_hold_time_ms": 180,
            "avg_flight_time_ms": 240,
        },
        "memory": None,
        "reaction": {
            "avg_reaction_time_ms": 550, "fastest_reaction_ms": 380,
            "slowest_reaction_ms": 850, "false_start_count": 3,
        },
        "speech": None,
        "facial": None,
    })

    assert result["screening_level"] in ["LOW", "MODERATE", "HIGH"]
    assert result["modalities_present"]["typing"] == True
    assert result["modalities_present"]["memory"] == False
    assert result["modalities_present"]["reaction"] == True
    assert result["modalities_present"]["speech"] == False
    assert result["modalities_present"]["facial"] == False

    print(f"  Screening Level: {result['screening_level']}")
    print(f"  Overall Score: {result['overall_score']}")
    print(f"  Distribution: {result['model_distribution']}")
    print(f"  Modalities: {result['modalities_present']}")
    print("  PASSED")


def test_prediction_no_modules():
    print("\n--- Test 4: Prediction (no modules — should fail) ---")
    try:
        predict_screening({
            "typing": None,
            "memory": None,
            "reaction": None,
            "speech": None,
            "facial": None,
        })
        print("  FAILED — should have raised ValueError")
    except ValueError as e:
        print(f"  Correctly raised ValueError: {e}")
        print("  PASSED")


def test_model_info():
    print("\n--- Test 5: Model Info (admin dashboard) ---")
    loader = get_model_loader()
    info = loader.get_model_info()

    assert info["model_name"] != "Not loaded"
    assert "disclaimer" in info
    assert "metrics" in info

    print(f"  Model: {info['model_name']} v{info['model_version']}")
    print(f"  Training date: {info['training_date']}")
    print(f"  Disclaimer: {info['disclaimer'][:60]}...")
    print("  PASSED")


if __name__ == "__main__":
    print("=" * 60)
    print("NeuroScreen ML Pipeline — Verification")
    print("=" * 60)
    print()

    test_model_loading()
    test_prediction_all_modules()
    test_prediction_partial_modules()
    test_prediction_no_modules()
    test_model_info()

    print()
    print("=" * 60)
    print("ALL TESTS PASSED")
    print("=" * 60)
