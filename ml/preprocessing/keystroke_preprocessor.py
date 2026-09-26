"""
NeuroScreen -- Keystroke Dynamics Preprocessing Pipeline
=========================================================
Handles data extraction, feature engineering, validation, and preprocessing
for the keystroke dynamics behavioral screening component.

Trained and validated on real keystroke timing data (DSL-StrongPasswordData).
Extracts and normalizes the exact 6 typing features expected by the
frontend assessment interface and FastAPI backend:
  - wpm: Words Per Minute
  - cpm: Characters Per Minute
  - accuracy: Typing accuracy ratio (0.0 to 1.0)
  - backspace_rate: Ratio of backspaces to characters typed
  - avg_hold_time_ms: Average key hold/dwell time in milliseconds
  - avg_flight_time_ms: Average inter-key release-to-press interval in milliseconds

IMPORTANT ETHICAL & CLINICAL NOTICE:
------------------------------------
This pipeline and its models measure behavioral keystroke dynamics and motor
latency patterns. They are part of an educational/research prototype.
Subject IDs and typing timing variations must NOT be construed as clinical
diagnoses of Parkinson's disease or any other neurological condition.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional, Union

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger("neuroscreen.keystroke.preprocessing")

# -------------------------------------------------------
# Feature & Target Schema
# -------------------------------------------------------

KEYSTROKE_FEATURE_COLUMNS = [
    "wpm",
    "cpm",
    "accuracy",
    "backspace_rate",
    "avg_hold_time_ms",
    "avg_flight_time_ms",
]

CLASS_NAMES = ["LOW", "MODERATE", "HIGH"]

# Feature boundaries for realistic clamping & outlier handling
FEATURE_BOUNDS = {
    "wpm": (5.0, 150.0),
    "cpm": (25.0, 750.0),
    "accuracy": (0.0, 1.0),
    "backspace_rate": (0.0, 1.0),
    "avg_hold_time_ms": (20.0, 500.0),
    "avg_flight_time_ms": (-50.0, 1500.0),  # Negative UD represents key rollover
}


class KeystrokePreprocessor:
    """
    Preprocessing pipeline for keystroke behavioral feature data.

    Responsibilities:
      1. Extract timing aggregates from raw keystroke datasets (e.g. DSL-StrongPasswordData).
      2. Normalize input representations from frontend/backend assessment payloads.
      3. Impute missing values using fitted medians.
      4. Cap outliers using IQR bounds (IQR x 1.5).
      5. Standardize numeric features using StandardScaler.
    """

    def __init__(self):
        self.scaler: Optional[StandardScaler] = None
        self.medians: Optional[dict[str, float]] = None
        self.iqr_bounds: Optional[dict[str, tuple[float, float]]] = None
        self.feature_columns: list[str] = list(KEYSTROKE_FEATURE_COLUMNS)
        self.is_fitted: bool = False

    @staticmethod
    def extract_features_from_dsl(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
        """
        Extract canonical typing features from the DSL-StrongPasswordData dataset.

        In the DSL dataset:
          - 'H.<key>' represents key hold/dwell time in seconds for 11 keys:
            ['H.period', 'H.t', 'H.i', 'H.e', 'H.five', 'H.Shift.r', 'H.o', 'H.a', 'H.n', 'H.l', 'H.Return']
          - 'DD.<k1>.<k2>' represents key-to-key latency (down-to-down) in seconds for 10 transitions.
          - 'UD.<k1>.<k2>' represents flight time (up-to-down) in seconds for 10 transitions.
          - Each repetition records the entry of the 11-key password '.tie5Roanl\\n'.

        Returns:
            X: DataFrame with canonical features [wpm, cpm, accuracy, backspace_rate, avg_hold_time_ms, avg_flight_time_ms]
            groups: Series of subject IDs for leakage-free group-based splitting
        """
        h_cols = [c for c in df.columns if c.startswith("H.")]
        dd_cols = [c for c in df.columns if c.startswith("DD.")]
        ud_cols = [c for c in df.columns if c.startswith("UD.")]

        # Timing metrics in milliseconds
        avg_hold_time_ms = df[h_cols].mean(axis=1) * 1000.0
        avg_flight_time_ms = df[ud_cols].mean(axis=1) * 1000.0

        # Total typing duration in seconds (sum of press-to-press intervals + last key hold)
        total_time_seconds = df[dd_cols].sum(axis=1) + df["H.Return"]

        # Typing speed: 11 characters typed in total_time_seconds
        cpm = (11.0 / total_time_seconds) * 60.0
        wpm = cpm / 5.0

        # DSL dataset records successful repetitions with zero backspaces
        # We assign baseline accuracy (1.0) and backspace rate (0.0) with slight realistic
        # variation correlated with typing fluency so the scaler learns full representations.
        rng = np.random.RandomState(42)
        n = len(df)
        fluency_factor = np.clip(wpm / 80.0, 0.5, 1.2)
        accuracy = np.clip(0.95 * fluency_factor + rng.normal(0, 0.02, n), 0.70, 1.0)
        backspace_rate = np.clip(0.04 * (1.5 - fluency_factor) + rng.normal(0, 0.01, n), 0.0, 0.20)

        X = pd.DataFrame({
            "wpm": wpm.values,
            "cpm": cpm.values,
            "accuracy": accuracy,
            "backspace_rate": backspace_rate,
            "avg_hold_time_ms": avg_hold_time_ms.values,
            "avg_flight_time_ms": avg_flight_time_ms.values,
        })

        groups = df["subject"] if "subject" in df.columns else pd.Series(np.zeros(len(df)))
        return X, groups

    @staticmethod
    def derive_behavioral_target(X: pd.DataFrame) -> np.ndarray:
        """
        Derive the objective behavioral motor screening category (LOW, MODERATE, HIGH).

        Uses composite normalized motor speed & latency score (0 to 100):
          - Higher score = fluent, lower motor latency, typical typing rhythm.
          - Lower score = prolonged hold time, elevated flight latency, slower motor execution.

        Categories:
          - 0 (LOW screening concern): Score >= 65
          - 1 (MODERATE screening concern): 45 <= Score < 65
          - 2 (HIGH screening concern): Score < 45

        This is purely a behavioral categorization of keystroke timing and does NOT
        represent a neurological disease diagnosis.
        """
        def _norm(val: pd.Series, vmin: float, vmax: float, higher_better: bool) -> pd.Series:
            c = np.clip(val, vmin, vmax)
            n = (c - vmin) / (vmax - vmin)
            return n if higher_better else (1.0 - n)

        wpm_n = _norm(X["wpm"], 15.0, 80.0, True)
        cpm_n = _norm(X["cpm"], 75.0, 400.0, True)
        hold_n = _norm(X["avg_hold_time_ms"], 50.0, 250.0, False)
        flight_n = _norm(X["avg_flight_time_ms"], 60.0, 300.0, False)
        acc_n = _norm(X["accuracy"], 0.70, 1.0, True)
        bs_n = _norm(X["backspace_rate"], 0.0, 0.25, False)

        # Composite score: timing (80%) + accuracy/errors (20%)
        composite = (
            (wpm_n * 0.25 + cpm_n * 0.25 + hold_n * 0.25 + flight_n * 0.25) * 0.80
            + (acc_n * 0.50 + bs_n * 0.50) * 0.20
        ) * 100.0

        targets = np.where(composite >= 65.0, 0, np.where(composite >= 45.0, 1, 2))
        return targets

    def fit(self, X: pd.DataFrame, y: Optional[np.ndarray] = None) -> "KeystrokePreprocessor":
        """Compute training medians, IQR clipping bounds, and fit StandardScaler."""
        df = X[self.feature_columns].copy()

        # 1. Medians for imputation
        self.medians = {col: float(df[col].median()) for col in self.feature_columns}

        # 2. IQR bounds for outlier mitigation
        self.iqr_bounds = {}
        for col in self.feature_columns:
            q25 = float(df[col].quantile(0.25))
            q75 = float(df[col].quantile(0.75))
            iqr = q75 - q25
            lower = q25 - 1.5 * iqr
            upper = q75 + 1.5 * iqr
            # Bound within physical constraints if defined
            phys_min, phys_max = FEATURE_BOUNDS.get(col, (lower, upper))
            self.iqr_bounds[col] = (max(lower, phys_min), min(upper, phys_max))

        # 3. Apply imputation and clipping prior to fitting scaler
        df_clean = df.fillna(self.medians)
        for col, (lower, upper) in self.iqr_bounds.items():
            df_clean[col] = df_clean[col].clip(lower, upper)

        # 4. Fit StandardScaler
        self.scaler = StandardScaler()
        self.scaler.fit(df_clean[self.feature_columns].values)
        self.is_fitted = True

        return self

    def transform(self, X: Union[pd.DataFrame, dict[str, Any]]) -> np.ndarray:
        """
        Transform raw input features using the fitted preprocessor.

        Accepts either a DataFrame or a dictionary of feature key-values.
        """
        if not self.is_fitted or self.scaler is None:
            raise RuntimeError("KeystrokePreprocessor is not fitted. Call fit() first.")

        if isinstance(X, dict):
            # Normalize dictionary keys and value formats
            norm_dict = {}
            for col in self.feature_columns:
                val = X.get(col)
                if val is None and col == "backspace_rate":
                    # Fallback if frontend sent backspace_count
                    b_count = X.get("backspace_count")
                    chars = X.get("total_chars") or X.get("totalCharsTyped") or 50
                    val = float(b_count) / max(1, float(chars)) if b_count is not None else None

                if val is not None:
                    try:
                        val = float(val)
                        # If accuracy passed as 0-100%, normalize to 0-1
                        if col == "accuracy" and val > 1.0:
                            val /= 100.0
                    except (ValueError, TypeError):
                        val = None
                norm_dict[col] = val
            df = pd.DataFrame([norm_dict])
        else:
            df = X[self.feature_columns].copy()

        # Impute missing values
        df_clean = df.fillna(self.medians)

        # Clip outliers using fitted IQR bounds
        for col, (lower, upper) in self.iqr_bounds.items():
            if col in df_clean.columns:
                df_clean[col] = df_clean[col].clip(lower, upper)

        return self.scaler.transform(df_clean[self.feature_columns].values)

    def fit_transform(self, X: pd.DataFrame, y: Optional[np.ndarray] = None) -> np.ndarray:
        """Fit the preprocessor and transform the input data in a single pass."""
        self.fit(X, y)
        return self.transform(X)

    def save(self, filepath: Union[str, Path]) -> None:
        """Serialize fitted preprocessor state to disk using joblib."""
        if not self.is_fitted:
            raise RuntimeError("Cannot save unfitted preprocessor.")
        data = {
            "scaler": self.scaler,
            "medians": self.medians,
            "iqr_bounds": self.iqr_bounds,
            "feature_columns": self.feature_columns,
            "class_names": CLASS_NAMES,
            "version": "1.0.0",
        }
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(data, filepath)
        logger.info(f"KeystrokePreprocessor saved to {filepath}")

    @classmethod
    def load(cls, filepath: Union[str, Path]) -> "KeystrokePreprocessor":
        """Deserialize fitted preprocessor state from disk."""
        data = joblib.load(filepath)
        instance = cls()
        instance.scaler = data["scaler"]
        instance.medians = data["medians"]
        instance.iqr_bounds = data["iqr_bounds"]
        instance.feature_columns = data.get("feature_columns", KEYSTROKE_FEATURE_COLUMNS)
        instance.is_fitted = True
        return instance


# -------------------------------------------------------
# Reusable Application Prediction Function
# -------------------------------------------------------

_CACHED_MODEL = None
_CACHED_PREPROCESSOR = None


def predict_keystroke(
    features: dict[str, Any],
    model: Optional[Any] = None,
    preprocessor: Optional[KeystrokePreprocessor] = None,
    models_dir: Optional[Union[str, Path]] = None,
) -> dict[str, Any]:
    """
    Reusable prediction function that accepts keystroke features from the
    frontend assessment component or backend API and produces a structured
    behavioral screening evaluation.

    Args:
        features: Dictionary containing typing metrics:
            - wpm: float (Words Per Minute)
            - cpm: float (Characters Per Minute)
            - accuracy: float (0.0-1.0 or 0-100)
            - backspace_rate or backspace_count: float
            - avg_hold_time_ms: float (Dwell time in ms)
            - avg_flight_time_ms: float (Inter-key flight time in ms)
        model: Optional pre-loaded classifier. If None, loaded from disk.
        preprocessor: Optional pre-loaded KeystrokePreprocessor.
        models_dir: Optional custom path to directory containing model joblib files.

    Returns:
        Structured result dict:
            - screening_level: "LOW" | "MODERATE" | "HIGH"
            - score: float (0.0 to 100.0, higher indicates better typing fluency)
            - confidence_distribution: dict mapping class -> probability
            - features_used: dict of processed and validated feature inputs
            - metrics_summary: human-readable motor summary
            - disclaimer: ethical / clinical research notice
    """
    global _CACHED_MODEL, _CACHED_PREPROCESSOR

    if models_dir is None:
        project_root = Path(__file__).resolve().parent.parent.parent
        models_dir = project_root / "ml" / "models"
    else:
        models_dir = Path(models_dir)

    # Load artifacts if not provided
    if preprocessor is None:
        if _CACHED_PREPROCESSOR is None:
            pp_path = models_dir / "keystroke_preprocessor.joblib"
            if not pp_path.exists():
                raise FileNotFoundError(f"Keystroke preprocessor not found at {pp_path}. Run training first.")
            _CACHED_PREPROCESSOR = KeystrokePreprocessor.load(pp_path)
        preprocessor = _CACHED_PREPROCESSOR

    if model is None:
        if _CACHED_MODEL is None:
            m_path = models_dir / "keystroke_model.joblib"
            if not m_path.exists():
                raise FileNotFoundError(f"Keystroke model not found at {m_path}. Run training first.")
            _CACHED_MODEL = joblib.load(m_path)
        model = _CACHED_MODEL

    # Preprocess feature dict
    X_scaled = preprocessor.transform(features)

    # Model inference
    pred_idx = int(model.predict(X_scaled)[0])
    screening_level = CLASS_NAMES[pred_idx]

    # Confidence distribution
    if hasattr(model, "predict_proba"):
        probas = model.predict_proba(X_scaled)[0]
        confidence_dist = {cls_name: round(float(probas[i]), 4) for i, cls_name in enumerate(CLASS_NAMES)}
    else:
        confidence_dist = {cls_name: 1.0 if cls_name == screening_level else 0.0 for cls_name in CLASS_NAMES}

    # Behavioral typing score (0-100)
    # Higher score = lower motor risk / better fluency
    wpm_val = float(features.get("wpm", 45.0))
    acc_val = float(features.get("accuracy", 0.90))
    if acc_val > 1.0:
        acc_val /= 100.0
    hold_val = float(features.get("avg_hold_time_ms", 100.0))
    flight_val = float(features.get("avg_flight_time_ms", 140.0))

    wpm_score = min(wpm_val / 80.0, 1.0) * 100.0
    acc_score = acc_val * 100.0
    hold_score = max(0.0, 100.0 - abs(hold_val - 100.0) * 0.4)
    flight_score = max(0.0, 100.0 - abs(flight_val - 130.0) * 0.3)
    raw_score = wpm_score * 0.30 + acc_score * 0.30 + hold_score * 0.20 + flight_score * 0.20
    score = round(float(np.clip(raw_score, 0.0, 100.0)), 1)

    return {
        "screening_level": screening_level,
        "score": score,
        "confidence_distribution": confidence_dist,
        "features_used": {col: float(features.get(col, 0.0)) for col in KEYSTROKE_FEATURE_COLUMNS},
        "metrics_summary": {
            "avg_hold_time_ms": hold_val,
            "avg_flight_time_ms": flight_val,
            "wpm": wpm_val,
            "accuracy": acc_val,
        },
        "model_name": type(model).__name__,
        "disclaimer": (
            "Research and educational prototype. Evaluates behavioral keystroke motor timing. "
            "This assessment is NOT a medical diagnosis and cannot diagnose Parkinson's disease "
            "or any other neurological disorder."
        ),
    }
