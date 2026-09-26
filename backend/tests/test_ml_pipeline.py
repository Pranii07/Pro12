"""
NeuroScreen — ML Pipeline Tests
==================================
Unit tests for the ML prediction pipeline:
  - Preprocessor (schema validation, imputation, scaling, persistence)
  - Feature fusion (all modules, partial, no modules)
  - Predictor (full/partial prediction, edge cases)
  - Model metadata

These tests run without Supabase — they test ML logic directly.

IMPORTANT: Research/Educational Prototype — synthetic data only.
"""

import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import numpy as np
import pandas as pd
import pytest

# Add project root to path so we can import ml modules
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.ml.predictor import (
    build_feature_dataframe,
    preprocess_features,
    predict_screening,
    FEATURE_COLUMNS,
    INDICATOR_COLUMNS,
    MODULE_FEATURE_MAP,
    CLASS_NAMES,
)
from app.ml.model_loader import ModelLoader


# -------------------------------------------------------
# Fixtures
# -------------------------------------------------------

@pytest.fixture
def full_module_results():
    """All five modules completed with realistic feature values."""
    return {
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
    }


@pytest.fixture
def partial_module_results():
    """Only typing + reaction completed; others skipped."""
    return {
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
    }


@pytest.fixture
def no_module_results():
    """All modules skipped."""
    return {
        "typing": None,
        "memory": None,
        "reaction": None,
        "speech": None,
        "facial": None,
    }


@pytest.fixture
def mock_model_loader():
    """Create a mock model loader with a fitted preprocessor."""
    # Build a simple preprocessor data dict that matches the real format
    from sklearn.preprocessing import StandardScaler

    scaler = StandardScaler()
    # Fit on some dummy data
    n_features = len(FEATURE_COLUMNS)
    dummy_data = np.random.randn(100, n_features) * 10 + 50
    scaler.fit(dummy_data)

    medians = {col: float(50 + i) for i, col in enumerate(FEATURE_COLUMNS)}
    iqr_bounds = {col: (0.0, 200.0) for col in FEATURE_COLUMNS}

    preprocessor_data = {
        "scaler": scaler,
        "medians": medians,
        "iqr_bounds": iqr_bounds,
        "feature_columns": FEATURE_COLUMNS,
        "indicator_columns": INDICATOR_COLUMNS,
    }

    # Mock a simple model
    mock_model = MagicMock()
    mock_model.predict.return_value = np.array([0])  # LOW
    mock_model.predict_proba.return_value = np.array([[0.7, 0.2, 0.1]])

    loader = ModelLoader()
    loader.model = mock_model
    loader.preprocessor = preprocessor_data
    loader.metadata = {
        "model_name": "TestModel",
        "model_version": "0.0.1",
    }
    loader.is_loaded = True

    return loader


# -------------------------------------------------------
# Feature Fusion Tests
# -------------------------------------------------------

class TestBuildFeatureDataframe:
    """Tests for build_feature_dataframe()."""

    def test_full_modules_shape(self, full_module_results):
        """Full module results produce correct shape."""
        df = build_feature_dataframe(full_module_results)
        assert df.shape[0] == 1
        # 22 features + 5 indicators = 27 columns
        assert len(df.columns) == 27

    def test_full_modules_all_present(self, full_module_results):
        """All indicator flags should be 1 when all modules completed."""
        df = build_feature_dataframe(full_module_results)
        for col in INDICATOR_COLUMNS:
            assert df[col].iloc[0] == 1

    def test_partial_modules_indicators(self, partial_module_results):
        """Only completed modules should have indicator=1."""
        df = build_feature_dataframe(partial_module_results)
        assert df["typing_present"].iloc[0] == 1
        assert df["reaction_present"].iloc[0] == 1
        assert df["memory_present"].iloc[0] == 0
        assert df["speech_present"].iloc[0] == 0
        assert df["facial_present"].iloc[0] == 0

    def test_partial_modules_nan_for_missing(self, partial_module_results):
        """Missing module features should be NaN."""
        df = build_feature_dataframe(partial_module_results)
        # Memory features should be NaN
        assert pd.isna(df["word_recall_accuracy"].iloc[0])
        assert pd.isna(df["number_recall_accuracy"].iloc[0])
        # Typing features should NOT be NaN
        assert not pd.isna(df["wpm"].iloc[0])
        assert df["wpm"].iloc[0] == 30

    def test_no_modules_all_nan(self, no_module_results):
        """All-skipped modules should produce all NaN features."""
        df = build_feature_dataframe(no_module_results)
        for col in FEATURE_COLUMNS:
            assert pd.isna(df[col].iloc[0])
        for col in INDICATOR_COLUMNS:
            assert df[col].iloc[0] == 0

    def test_missing_feature_key_becomes_nan(self):
        """If a module result dict is missing a feature key, it becomes NaN."""
        results = {
            "typing": {"wpm": 55},  # Only wpm, rest missing
            "memory": None,
            "reaction": None,
            "speech": None,
            "facial": None,
        }
        df = build_feature_dataframe(results)
        assert df["wpm"].iloc[0] == 55
        assert pd.isna(df["cpm"].iloc[0])  # Missing key → NaN
        assert df["typing_present"].iloc[0] == 1  # Module was attempted

    def test_feature_columns_order(self, full_module_results):
        """All expected feature columns exist in the DataFrame."""
        df = build_feature_dataframe(full_module_results)
        for col in FEATURE_COLUMNS + INDICATOR_COLUMNS:
            assert col in df.columns, f"Missing column: {col}"


# -------------------------------------------------------
# Preprocessor Tests
# -------------------------------------------------------

class TestPreprocessFeatures:
    """Tests for preprocess_features() using mock model loader."""

    def test_preprocess_output_shape(self, full_module_results, mock_model_loader):
        """Preprocessed output should be (1, 27)."""
        with patch("app.ml.predictor.get_model_loader", return_value=mock_model_loader):
            df = build_feature_dataframe(full_module_results)
            X = preprocess_features(df)
            assert X.shape == (1, 27)

    def test_preprocess_no_nans(self, partial_module_results, mock_model_loader):
        """After preprocessing, there should be no NaN values (imputation fills them)."""
        with patch("app.ml.predictor.get_model_loader", return_value=mock_model_loader):
            df = build_feature_dataframe(partial_module_results)
            X = preprocess_features(df)
            assert not np.any(np.isnan(X))

    def test_preprocess_raises_when_not_loaded(self, full_module_results):
        """Should raise RuntimeError when model is not loaded."""
        unloaded_loader = ModelLoader()
        with patch("app.ml.predictor.get_model_loader", return_value=unloaded_loader):
            df = build_feature_dataframe(full_module_results)
            with pytest.raises(RuntimeError, match="ML model not loaded"):
                preprocess_features(df)


# -------------------------------------------------------
# Predictor Tests
# -------------------------------------------------------

class TestPredictScreening:
    """Tests for predict_screening()."""

    def test_full_prediction_structure(self, full_module_results, mock_model_loader):
        """Full prediction should return all expected fields."""
        with patch("app.ml.predictor.get_model_loader", return_value=mock_model_loader):
            result = predict_screening(full_module_results)

        assert "screening_level" in result
        assert result["screening_level"] in CLASS_NAMES
        assert "overall_score" in result
        assert 0 <= result["overall_score"] <= 100
        assert "model_distribution" in result
        assert len(result["model_distribution"]) == 3
        assert "modalities_present" in result
        assert "model_name" in result
        assert "model_version" in result
        assert "features_used" in result

    def test_full_prediction_all_present(self, full_module_results, mock_model_loader):
        """All modalities should be marked as present."""
        with patch("app.ml.predictor.get_model_loader", return_value=mock_model_loader):
            result = predict_screening(full_module_results)
        for module in MODULE_FEATURE_MAP:
            assert result["modalities_present"][module] is True

    def test_partial_prediction(self, partial_module_results, mock_model_loader):
        """Partial modules should produce valid prediction with correct modality flags."""
        with patch("app.ml.predictor.get_model_loader", return_value=mock_model_loader):
            result = predict_screening(partial_module_results)

        assert result["screening_level"] in CLASS_NAMES
        assert result["modalities_present"]["typing"] is True
        assert result["modalities_present"]["reaction"] is True
        assert result["modalities_present"]["memory"] is False
        assert result["modalities_present"]["speech"] is False
        assert result["modalities_present"]["facial"] is False

    def test_no_modules_raises_error(self, no_module_results, mock_model_loader):
        """Should raise ValueError when no modules are completed."""
        with patch("app.ml.predictor.get_model_loader", return_value=mock_model_loader):
            with pytest.raises(ValueError, match="At least one"):
                predict_screening(no_module_results)

    def test_model_not_loaded_raises(self, full_module_results):
        """Should raise RuntimeError when model is not loaded."""
        unloaded_loader = ModelLoader()
        with patch("app.ml.predictor.get_model_loader", return_value=unloaded_loader):
            with pytest.raises(RuntimeError, match="ML model not loaded"):
                predict_screening(full_module_results)

    def test_distribution_sums_roughly_to_one(self, full_module_results, mock_model_loader):
        """Model distribution values should sum to approximately 1.0."""
        with patch("app.ml.predictor.get_model_loader", return_value=mock_model_loader):
            result = predict_screening(full_module_results)
        total = sum(result["model_distribution"].values())
        assert abs(total - 1.0) < 0.01


# -------------------------------------------------------
# Model Loader Tests
# -------------------------------------------------------

class TestModelLoader:
    """Tests for ModelLoader."""

    def test_initial_state(self):
        """New loader should be unloaded."""
        loader = ModelLoader()
        assert loader.is_loaded is False
        assert loader.model is None
        assert loader.preprocessor is None
        assert loader.metadata == {}

    def test_get_model_info_unloaded(self):
        """Unloaded model should return safe defaults."""
        loader = ModelLoader()
        info = loader.get_model_info()
        assert info["model_name"] == "Not loaded"
        assert info["model_version"] == "N/A"
        assert "disclaimer" in info

    def test_get_model_info_loaded(self, mock_model_loader):
        """Loaded model should return metadata."""
        info = mock_model_loader.get_model_info()
        assert info["model_name"] == "TestModel"
        assert info["model_version"] == "0.0.1"
        assert "disclaimer" in info

    def test_load_missing_files(self, tmp_path):
        """Loading from non-existent files should return False."""
        loader = ModelLoader()
        result = loader.load(
            model_path=tmp_path / "nonexistent.joblib",
            preprocessor_path=tmp_path / "nonexistent_pp.joblib",
            metadata_path=tmp_path / "nonexistent_meta.json",
        )
        assert result is False
        assert loader.is_loaded is False


# -------------------------------------------------------
# Preprocessor Persistence Tests
# -------------------------------------------------------

class TestPreprocessorPersistence:
    """Tests for NeuroScreenPreprocessor save/load round-trip."""

    def test_save_load_roundtrip(self):
        """Preprocessor should produce same results after save/load."""
        from ml.preprocessing.preprocessor import NeuroScreenPreprocessor

        # Create a small test DataFrame
        rng = np.random.default_rng(42)
        n = 50
        data = {}
        for col in FEATURE_COLUMNS:
            data[col] = rng.normal(50, 10, n)
        for col in INDICATOR_COLUMNS:
            data[col] = 1
        data["screening_level"] = rng.choice([0, 1, 2], n)
        df = pd.DataFrame(data)

        # Fit
        pp = NeuroScreenPreprocessor()
        X_original, y_original = pp.fit_transform(df)

        # Save
        with tempfile.NamedTemporaryFile(suffix=".joblib", delete=False) as f:
            save_path = f.name
        pp.save(save_path)

        # Load
        pp_loaded = NeuroScreenPreprocessor.load(save_path)
        assert pp_loaded.is_fitted

        # Transform same data
        X_loaded = pp_loaded.transform(df.drop(columns=["screening_level"]))

        # Results should match
        np.testing.assert_array_almost_equal(X_original, X_loaded, decimal=10)

        # Cleanup
        Path(save_path).unlink(missing_ok=True)
