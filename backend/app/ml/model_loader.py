"""
NeuroScreen — ML Model Loader
================================
Loads the trained ML model, preprocessor, and metadata on application
startup. Provides a singleton accessor for the loaded model.

The model and preprocessor are loaded from .joblib files.
Metadata (model name, version, metrics, feature schema) is loaded
from a JSON file.

This module is read-only at runtime — it loads models but never
triggers retraining.

IMPORTANT: Research/Educational Prototype — trained and evaluated
on synthetic data. Not clinically validated.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

import joblib

logger = logging.getLogger("neuroscreen.ml.loader")


class ModelLoader:
    """
    Singleton-style ML model loader.

    Loads:
      - best_model.joblib (the trained sklearn/XGBoost model)
      - preprocessor.joblib (fitted NeuroScreen preprocessor)
      - model_metadata.json (metadata about training)

    Thread-safe for read access (model + preprocessor are immutable
    after loading).
    """

    def __init__(self):
        self.model: Any = None
        self.preprocessor: Any = None
        self.metadata: dict = {}
        self.is_loaded: bool = False
        self._model_path: Optional[Path] = None
        self._preprocessor_path: Optional[Path] = None
        self._metadata_path: Optional[Path] = None

    def load(
        self,
        model_path: str | Path,
        preprocessor_path: str | Path,
        metadata_path: str | Path,
    ) -> bool:
        """
        Load model, preprocessor, and metadata from disk.

        Args:
            model_path: Path to best_model.joblib
            preprocessor_path: Path to preprocessor.joblib
            metadata_path: Path to model_metadata.json

        Returns:
            True if all files loaded successfully, False otherwise
        """
        self._model_path = Path(model_path)
        self._preprocessor_path = Path(preprocessor_path)
        self._metadata_path = Path(metadata_path)

        # Check files exist
        if not self._model_path.exists():
            logger.warning(f"Model file not found: {self._model_path}")
            return False
        if not self._preprocessor_path.exists():
            logger.warning(f"Preprocessor file not found: {self._preprocessor_path}")
            return False
        if not self._metadata_path.exists():
            logger.warning(f"Metadata file not found: {self._metadata_path}")
            return False

        try:
            # Load model
            self.model = joblib.load(self._model_path)
            logger.info(f"Model loaded from {self._model_path}")

            # Load preprocessor data (dict with scaler, medians, etc.)
            self.preprocessor = joblib.load(self._preprocessor_path)
            logger.info(f"Preprocessor loaded from {self._preprocessor_path}")

            # Load metadata
            with open(self._metadata_path, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)
            logger.info(f"Metadata loaded from {self._metadata_path}")

            self.is_loaded = True
            logger.info(
                f"ML pipeline ready: {self.metadata.get('model_name', 'Unknown')} "
                f"v{self.metadata.get('model_version', 'N/A')}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to load ML pipeline: {e}")
            self.model = None
            self.preprocessor = None
            self.metadata = {}
            self.is_loaded = False
            return False

    def get_model_info(self) -> dict:
        """
        Return read-only model metadata for the admin dashboard.

        Returns a safe subset of metadata (never exposes internal paths
        or service keys).
        """
        if not self.is_loaded:
            return {
                "model_name": "Not loaded",
                "model_version": "N/A",
                "training_date": None,
                "dataset_description": "No model loaded",
                "feature_schema": {},
                "metrics": {},
                "disclaimer": (
                    "Research/Educational Prototype — trained and evaluated "
                    "on synthetic data. Not clinically validated."
                ),
            }

        return {
            "model_name": self.metadata.get("model_name", "Unknown"),
            "model_version": self.metadata.get("model_version", "N/A"),
            "training_date": self.metadata.get("training_date"),
            "dataset_description": self.metadata.get("dataset_description", "N/A"),
            "feature_schema": self.metadata.get("feature_schema", {}),
            "metrics": self.metadata.get("metrics", {}),
            "all_model_results": self.metadata.get("all_model_results", {}),
            "n_train_samples": self.metadata.get("n_train_samples"),
            "n_test_samples": self.metadata.get("n_test_samples"),
            "class_names": self.metadata.get("class_names", ["LOW", "MODERATE", "HIGH"]),
            "preprocessing": self.metadata.get("preprocessing", {}),
            "hyperparameters": self.metadata.get("hyperparameters", {}),
            "disclaimer": (
                "Research/Educational Prototype — trained and evaluated "
                "on synthetic data. Not clinically validated."
            ),
        }


# -------------------------------------------------------
# Singleton Instance
# -------------------------------------------------------
# Created once, loaded on app startup via main.py

_model_loader = ModelLoader()


def get_model_loader() -> ModelLoader:
    """Get the singleton ModelLoader instance."""
    return _model_loader


def init_model_loader(
    model_path: str | Path,
    preprocessor_path: str | Path,
    metadata_path: str | Path,
) -> bool:
    """
    Initialize the singleton model loader.
    Called once during application startup.
    """
    return _model_loader.load(model_path, preprocessor_path, metadata_path)
