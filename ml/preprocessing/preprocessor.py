"""
NeuroScreen — Feature Preprocessing Pipeline
===============================================
Handles data preprocessing for ML training and inference:
  - Feature validation against expected schema
  - Missing-value handling (median imputation for missing modalities)
  - Outlier capping (IQR-based)
  - StandardScaler normalization
  - Fitted preprocessor export to .joblib

Missing-Modality Strategy (from docs/ml-pipeline.md):
  - Each module contributes a fixed-size feature block + binary indicator
  - Missing modules: impute with median from training data, indicator = 0
  - Training data includes randomized modality-dropout so models handle missingness

IMPORTANT: Research/Educational Prototype — synthetic data. Not clinically validated.

Usage:
    from ml.preprocessing.preprocessor import NeuroScreenPreprocessor
    pp = NeuroScreenPreprocessor()
    X_train, y_train = pp.fit_transform(df)
    pp.save("ml/models/preprocessor.joblib")
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger("neuroscreen.preprocessing")

# -------------------------------------------------------
# Feature Schema
# -------------------------------------------------------

FEATURE_COLUMNS = [
    # Typing (6)
    "wpm", "cpm", "accuracy", "backspace_rate", "avg_hold_time_ms", "avg_flight_time_ms",
    # Memory (4)
    "word_recall_accuracy", "number_recall_accuracy", "pattern_accuracy", "avg_response_time_ms",
    # Reaction (4)
    "avg_reaction_time_ms", "fastest_reaction_ms", "slowest_reaction_ms", "false_start_count",
    # Speech (4)
    "speech_rate_wpm", "avg_pause_duration_ms", "fluency_score", "transcript_word_count",
    # Facial (4)
    "blink_rate_per_min", "avg_head_movement", "orientation_stability", "attention_score",
]

INDICATOR_COLUMNS = [
    "typing_present",
    "memory_present",
    "reaction_present",
    "speech_present",
    "facial_present",
]

TARGET_COLUMN = "screening_level"

MODULE_FEATURE_MAP = {
    "typing":   ["wpm", "cpm", "accuracy", "backspace_rate", "avg_hold_time_ms", "avg_flight_time_ms"],
    "memory":   ["word_recall_accuracy", "number_recall_accuracy", "pattern_accuracy", "avg_response_time_ms"],
    "reaction": ["avg_reaction_time_ms", "fastest_reaction_ms", "slowest_reaction_ms", "false_start_count"],
    "speech":   ["speech_rate_wpm", "avg_pause_duration_ms", "fluency_score", "transcript_word_count"],
    "facial":   ["blink_rate_per_min", "avg_head_movement", "orientation_stability", "attention_score"],
}

MODULE_INDICATOR_MAP = {
    "typing":   "typing_present",
    "memory":   "memory_present",
    "reaction": "reaction_present",
    "speech":   "speech_present",
    "facial":   "facial_present",
}

# All feature + indicator columns used by the model
ALL_INPUT_COLUMNS = FEATURE_COLUMNS + INDICATOR_COLUMNS
N_TOTAL_FEATURES = len(ALL_INPUT_COLUMNS)  # 22 + 5 = 27


class NeuroScreenPreprocessor:
    """
    Preprocessing pipeline for NeuroScreen feature data.

    Handles:
    1. Feature validation
    2. Missing-value imputation (median from training data)
    3. Outlier capping (IQR × 1.5)
    4. StandardScaler normalization (on feature columns only, not indicators)
    """

    def __init__(self):
        self.scaler: Optional[StandardScaler] = None
        self.medians: Optional[dict[str, float]] = None
        self.iqr_bounds: Optional[dict[str, tuple[float, float]]] = None
        self.is_fitted = False

    # -------------------------------------------------------
    # Validation
    # -------------------------------------------------------

    @staticmethod
    def validate_schema(df: pd.DataFrame) -> list[str]:
        """Check that the DataFrame has the expected columns."""
        missing = [col for col in ALL_INPUT_COLUMNS if col not in df.columns]
        return missing

    @staticmethod
    def validate_indicators(df: pd.DataFrame) -> pd.DataFrame:
        """Ensure indicator columns are binary (0 or 1)."""
        for col in INDICATOR_COLUMNS:
            if col in df.columns:
                df[col] = df[col].fillna(0).astype(int).clip(0, 1)
        return df

    # -------------------------------------------------------
    # Imputation
    # -------------------------------------------------------

    def _compute_medians(self, df: pd.DataFrame) -> dict[str, float]:
        """Compute medians from training data for imputation."""
        medians = {}
        for col in FEATURE_COLUMNS:
            if col in df.columns:
                medians[col] = float(df[col].median())
            else:
                medians[col] = 0.0
        return medians

    def _impute_missing(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Impute missing feature values using training medians.

        For each module, if indicator=0 (module skipped), features are
        imputed with the training median. This is the documented
        missing-modality strategy.
        """
        if self.medians is None:
            raise RuntimeError("Preprocessor not fitted. Call fit_transform() first.")

        df = df.copy()
        for module_name, features in MODULE_FEATURE_MAP.items():
            indicator = MODULE_INDICATOR_MAP[module_name]
            for feat in features:
                if feat in df.columns:
                    # Impute NaN values with training median
                    df[feat] = df[feat].fillna(self.medians.get(feat, 0.0))

        return df

    # -------------------------------------------------------
    # Outlier Handling
    # -------------------------------------------------------

    def _compute_iqr_bounds(self, df: pd.DataFrame) -> dict[str, tuple[float, float]]:
        """Compute IQR-based bounds for outlier capping."""
        bounds = {}
        for col in FEATURE_COLUMNS:
            if col in df.columns:
                q1 = df[col].quantile(0.25)
                q3 = df[col].quantile(0.75)
                iqr = q3 - q1
                lower = q1 - 1.5 * iqr
                upper = q3 + 1.5 * iqr
                bounds[col] = (float(lower), float(upper))
        return bounds

    def _cap_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        """Cap outliers using IQR bounds from training data."""
        if self.iqr_bounds is None:
            return df

        df = df.copy()
        for col, (lower, upper) in self.iqr_bounds.items():
            if col in df.columns:
                df[col] = df[col].clip(lower, upper)
        return df

    # -------------------------------------------------------
    # Fit + Transform
    # -------------------------------------------------------

    def fit_transform(self, df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        """
        Fit the preprocessor on training data and return transformed arrays.

        Args:
            df: DataFrame with feature columns, indicator columns, and target column

        Returns:
            (X, y) where X is the preprocessed feature matrix and y is the target array
        """
        # Validate
        missing_cols = self.validate_schema(df)
        if missing_cols:
            logger.warning(f"Missing columns (will be added with defaults): {missing_cols}")
            for col in missing_cols:
                if col in INDICATOR_COLUMNS:
                    df[col] = 0
                else:
                    df[col] = np.nan

        # Validate indicators
        df = self.validate_indicators(df)

        # Extract target
        if TARGET_COLUMN not in df.columns:
            raise ValueError(f"Target column '{TARGET_COLUMN}' not found in DataFrame.")
        y = df[TARGET_COLUMN].values.astype(int)

        # Compute medians from training data (before imputation)
        self.medians = self._compute_medians(df)

        # Impute missing values
        df = self._impute_missing(df)

        # Compute IQR bounds and cap outliers
        self.iqr_bounds = self._compute_iqr_bounds(df)
        df = self._cap_outliers(df)

        # Scale feature columns (not indicators)
        self.scaler = StandardScaler()
        feature_values = df[FEATURE_COLUMNS].values
        scaled_features = self.scaler.fit_transform(feature_values)

        # Combine scaled features + indicators
        indicator_values = df[INDICATOR_COLUMNS].values.astype(float)
        X = np.hstack([scaled_features, indicator_values])

        self.is_fitted = True
        logger.info(f"Preprocessor fitted. X shape: {X.shape}, y shape: {y.shape}")
        return X, y

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        """
        Transform new data using the fitted preprocessor.

        Used during inference — applies the same imputation, capping,
        and scaling learned from training data.

        Args:
            df: DataFrame with feature and indicator columns (no target required)

        Returns:
            Preprocessed feature matrix (numpy array)
        """
        if not self.is_fitted:
            raise RuntimeError("Preprocessor not fitted. Call fit_transform() first.")

        # Validate and add missing columns
        missing_cols = self.validate_schema(df)
        if missing_cols:
            for col in missing_cols:
                if col in INDICATOR_COLUMNS:
                    df[col] = 0
                else:
                    df[col] = np.nan

        df = df.copy()
        df = self.validate_indicators(df)

        # Impute, cap, scale
        df = self._impute_missing(df)
        df = self._cap_outliers(df)

        feature_values = df[FEATURE_COLUMNS].values
        scaled_features = self.scaler.transform(feature_values)

        indicator_values = df[INDICATOR_COLUMNS].values.astype(float)
        X = np.hstack([scaled_features, indicator_values])

        return X

    # -------------------------------------------------------
    # Persistence
    # -------------------------------------------------------

    def save(self, path: str | Path) -> None:
        """Save the fitted preprocessor to a .joblib file."""
        if not self.is_fitted:
            raise RuntimeError("Cannot save unfitted preprocessor.")

        data = {
            "scaler": self.scaler,
            "medians": self.medians,
            "iqr_bounds": self.iqr_bounds,
            "feature_columns": FEATURE_COLUMNS,
            "indicator_columns": INDICATOR_COLUMNS,
            "all_input_columns": ALL_INPUT_COLUMNS,
            "module_feature_map": MODULE_FEATURE_MAP,
            "module_indicator_map": MODULE_INDICATOR_MAP,
        }
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(data, path)
        logger.info(f"Preprocessor saved to {path}")

    @classmethod
    def load(cls, path: str | Path) -> "NeuroScreenPreprocessor":
        """Load a fitted preprocessor from a .joblib file."""
        data = joblib.load(path)
        pp = cls()
        pp.scaler = data["scaler"]
        pp.medians = data["medians"]
        pp.iqr_bounds = data["iqr_bounds"]
        pp.is_fitted = True
        logger.info(f"Preprocessor loaded from {path}")
        return pp

    # -------------------------------------------------------
    # Utility: Build DataFrame from raw module results
    # -------------------------------------------------------

    @staticmethod
    def build_feature_dataframe(module_results: dict[str, dict | None]) -> pd.DataFrame:
        """
        Build a single-row DataFrame from module results (for inference).

        Args:
            module_results: Dict mapping module name → feature dict or None (if skipped).
                Example:
                    {
                        "typing": {"wpm": 55, "cpm": 275, ...},
                        "memory": None,  # skipped
                        "reaction": {"avg_reaction_time_ms": 350, ...},
                        "speech": None,  # skipped
                        "facial": None,  # skipped
                    }

        Returns:
            DataFrame with one row, all feature + indicator columns
        """
        row = {}

        for module_name in MODULE_FEATURE_MAP:
            indicator = MODULE_INDICATOR_MAP[module_name]
            features = MODULE_FEATURE_MAP[module_name]
            result = module_results.get(module_name)

            if result is not None and isinstance(result, dict):
                row[indicator] = 1
                for feat in features:
                    row[feat] = result.get(feat, np.nan)
            else:
                row[indicator] = 0
                for feat in features:
                    row[feat] = np.nan

        return pd.DataFrame([row])
