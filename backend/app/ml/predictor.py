"""
NeuroScreen — ML Predictor Service
=====================================
Handles inference: takes module results from an assessment, fuses
features, preprocesses them, runs the loaded model, and returns
a Behavioural Screening Level (LOW / MODERATE / HIGH).

Pipeline:
  1. Receive module results (typing, memory, reaction, speech, facial)
  2. Build feature DataFrame (handle missing/skipped modules)
  3. Apply fitted preprocessor (imputation, scaling)
  4. Run model prediction
  5. Return screening level + model screening distribution

IMPORTANT:
  - Predictions are NOT medical diagnoses
  - Model distribution is NOT calibrated probability (never call it that)
  - Always label as "Behavioural Screening Level"
  - Research/Educational Prototype — synthetic data

Usage:
    from app.ml.predictor import predict_screening
    result = predict_screening(module_results)
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import numpy as np
import pandas as pd

from app.ml.model_loader import get_model_loader

logger = logging.getLogger("neuroscreen.ml.predictor")

# -------------------------------------------------------
# Feature Schema (must match training)
# -------------------------------------------------------

FEATURE_COLUMNS = [
    "wpm", "cpm", "accuracy", "backspace_rate", "avg_hold_time_ms", "avg_flight_time_ms",
    "word_recall_accuracy", "number_recall_accuracy", "pattern_accuracy", "avg_response_time_ms",
    "avg_reaction_time_ms", "fastest_reaction_ms", "slowest_reaction_ms", "false_start_count",
    "speech_rate_wpm", "avg_pause_duration_ms", "fluency_score", "transcript_word_count",
    "blink_rate_per_min", "avg_head_movement", "orientation_stability", "attention_score",
]

INDICATOR_COLUMNS = [
    "typing_present",
    "memory_present",
    "reaction_present",
    "speech_present",
    "facial_present",
]

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

CLASS_NAMES = ["LOW", "MODERATE", "HIGH"]

# Expected feature ranges from synthetic data (min, max, higher_is_better)
# Used for normalizing raw features into 0-100 module scores
FEATURE_RANGES = {
    # Typing — higher WPM/CPM/accuracy = better, higher hold/flight time = worse
    "wpm": (15, 80, True),
    "cpm": (75, 400, True),
    "accuracy": (0.6, 1.0, True),
    "backspace_rate": (0.0, 0.25, False),
    "avg_hold_time_ms": (50, 250, False),
    "avg_flight_time_ms": (60, 300, False),
    # Memory — higher accuracy = better, lower response time = better
    "word_recall_accuracy": (0.3, 1.0, True),
    "number_recall_accuracy": (0.3, 1.0, True),
    "pattern_accuracy": (0.3, 1.0, True),
    "avg_response_time_ms": (500, 3500, False),
    # Reaction — lower reaction times = better (calibrated to human visual reaction benchmarks)
    "avg_reaction_time_ms": (220, 620, False),
    "fastest_reaction_ms": (160, 480, False),
    "slowest_reaction_ms": (280, 950, False),
    "false_start_count": (0, 4, False),
    # Speech — higher rate/fluency = better, lower pause = better
    "speech_rate_wpm": (60, 180, True),
    "avg_pause_duration_ms": (100, 1200, False),
    "fluency_score": (0.3, 1.0, True),
    "transcript_word_count": (10, 120, True),
    # Facial — stability and attention higher = better
    "blink_rate_per_min": (8, 25, None),  # neutral — normal range
    "avg_head_movement": (0, 15, False),
    "orientation_stability": (0.4, 1.0, True),
    "attention_score": (0.3, 1.0, True),
}


# -------------------------------------------------------
# Module Score Computation
# -------------------------------------------------------

def _normalize_feature(value: float, feat_min: float, feat_max: float, higher_is_better: bool | None) -> float:
    """Normalize a single feature value to 0-1 range."""
    if feat_max == feat_min:
        return 0.5
    clamped = max(feat_min, min(feat_max, value))
    normalized = (clamped - feat_min) / (feat_max - feat_min)
    if higher_is_better is False:
        normalized = 1.0 - normalized
    elif higher_is_better is None:
        # Neutral feature (e.g., blink rate) — score based on distance from midpoint
        midpoint = 0.5
        normalized = 1.0 - abs(normalized - midpoint) * 2
        normalized = max(0.0, normalized)
    return normalized


def compute_module_scores(module_results: dict[str, dict | None]) -> dict[str, float | None]:
    """
    Compute normalized 0-100 scores for each completed module.

    For each module, averages the normalized scores of its constituent
    features using known ranges from the synthetic training data.

    Args:
        module_results: Dict mapping module name -> feature dict or None

    Returns:
        Dict mapping module name -> score (0-100) or None if skipped
    """
    scores: dict[str, float | None] = {}

    for module_name, features in MODULE_FEATURE_MAP.items():
        result = module_results.get(module_name)
        if result is None or not isinstance(result, dict):
            scores[module_name] = None
            continue

        feature_scores = []
        for feat_key in features:
            raw_value = result.get(feat_key)
            if raw_value is None:
                continue
            try:
                raw_value = float(raw_value)
            except (ValueError, TypeError):
                continue

            ranges = FEATURE_RANGES.get(feat_key)
            if ranges is None:
                continue

            feat_min, feat_max, higher_is_better = ranges
            norm = _normalize_feature(raw_value, feat_min, feat_max, higher_is_better)
            feature_scores.append(norm)

        if feature_scores:
            avg = sum(feature_scores) / len(feature_scores)
            scores[module_name] = round(avg * 100, 1)
        else:
            scores[module_name] = None

    return scores


# -------------------------------------------------------
# Feature Fusion
# -------------------------------------------------------

def build_feature_dataframe(module_results: dict[str, dict | None]) -> pd.DataFrame:
    """
    Build a single-row DataFrame from assessment module results.

    Args:
        module_results: Dict mapping module name -> feature dict or None.
            Example:
                {
                    "typing": {"wpm": 55, "cpm": 275, "accuracy": 0.92, ...},
                    "memory": None,  # skipped
                    ...
                }

    Returns:
        DataFrame with one row containing all features + indicators
    """
    row: dict[str, Any] = {}

    for module_name in MODULE_FEATURE_MAP:
        indicator = MODULE_INDICATOR_MAP[module_name]
        features = MODULE_FEATURE_MAP[module_name]
        result = module_results.get(module_name)

        if result is not None and isinstance(result, dict):
            row[indicator] = 1
            for feat in features:
                row[feat] = result.get(feat, np.nan)
        else:
            # Module skipped — indicator = 0, features = NaN
            row[indicator] = 0
            for feat in features:
                row[feat] = np.nan

    return pd.DataFrame([row])


def preprocess_features(df: pd.DataFrame) -> np.ndarray:
    """
    Apply the fitted preprocessor to a feature DataFrame.

    Uses the preprocessor loaded at startup (medians, IQR bounds, scaler)
    to transform the input consistently with training.
    """
    loader = get_model_loader()
    if not loader.is_loaded or loader.preprocessor is None:
        raise RuntimeError("ML model not loaded. Cannot preprocess features.")

    pp_data = loader.preprocessor

    scaler = pp_data["scaler"]
    medians = pp_data["medians"]
    iqr_bounds = pp_data.get("iqr_bounds", {})

    df = df.copy()

    # Ensure indicator columns are binary
    for col in INDICATOR_COLUMNS:
        if col in df.columns:
            df[col] = df[col].fillna(0).astype(int).clip(0, 1)
        else:
            df[col] = 0

    # Impute missing features with training medians
    for col in FEATURE_COLUMNS:
        if col in df.columns:
            df[col] = df[col].fillna(medians.get(col, 0.0))
        else:
            df[col] = medians.get(col, 0.0)

    # Cap outliers
    for col, (lower, upper) in iqr_bounds.items():
        if col in df.columns:
            df[col] = df[col].clip(lower, upper)

    # Scale features
    feature_values = df[FEATURE_COLUMNS].values
    scaled_features = scaler.transform(feature_values)

    # Combine scaled features + indicators
    indicator_values = df[INDICATOR_COLUMNS].values.astype(float)
    X = np.hstack([scaled_features, indicator_values])

    return X


# -------------------------------------------------------
# Prediction
# -------------------------------------------------------

def predict_screening(
    module_results: dict[str, dict | None],
) -> dict[str, Any]:
    """
    Run ML screening prediction on assessment module results.

    Args:
        module_results: Dict mapping module name -> feature dict or None

    Returns:
        Dict with:
            - screening_level: "LOW", "MODERATE", or "HIGH"
            - overall_score: float (0-100)
            - model_distribution: {"LOW": x, "MODERATE": y, "HIGH": z}
            - modalities_present: {"typing": true/false, ...}
            - model_name: str
            - model_version: str
            - features_used: dict (preprocessed feature values)
    """
    loader = get_model_loader()
    if not loader.is_loaded:
        raise RuntimeError("ML model not loaded. Cannot make predictions.")

    # 1. Build feature DataFrame
    df = build_feature_dataframe(module_results)

    # 2. Track which modalities are present
    modalities_present = {}
    for module_name in MODULE_FEATURE_MAP:
        indicator = MODULE_INDICATOR_MAP[module_name]
        modalities_present[module_name] = bool(df[indicator].iloc[0] == 1)

    # Require at least one module completed
    if not any(modalities_present.values()):
        raise ValueError("At least one assessment module must be completed for prediction.")

    # 3. Preprocess
    X = preprocess_features(df)

    # 4. Predict
    model = loader.model
    y_pred = model.predict(X)[0]
    screening_level = CLASS_NAMES[int(y_pred)]

    # 5. Model screening distribution (NOT probability)
    model_distribution = {}
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(X)[0]
        for i, cls_name in enumerate(CLASS_NAMES):
            model_distribution[cls_name] = round(float(proba[i]), 4)
    else:
        # Fallback: one-hot based on prediction
        for cls_name in CLASS_NAMES:
            model_distribution[cls_name] = 1.0 if cls_name == screening_level else 0.0

    # 6. Overall score (0-100, based on distribution)
    # Higher score = more screening concern
    # LOW=0-33, MODERATE=34-66, HIGH=67-100
    overall_score = (
        model_distribution.get("LOW", 0) * 15 +
        model_distribution.get("MODERATE", 0) * 50 +
        model_distribution.get("HIGH", 0) * 90
    )
    overall_score = round(min(100, max(0, overall_score)), 1)

    # 7. Features used (for auditability)
    features_used = {}
    all_cols = FEATURE_COLUMNS + INDICATOR_COLUMNS
    for i, col_name in enumerate(all_cols):
        features_used[col_name] = round(float(X[0][i]), 4)

    # 8. Per-module scores
    module_scores = compute_module_scores(module_results)

    return {
        "screening_level": screening_level,
        "overall_score": overall_score,
        "model_distribution": model_distribution,
        "modalities_present": modalities_present,
        "module_scores": module_scores,
        "model_name": loader.metadata.get("model_name", "Unknown"),
        "model_version": loader.metadata.get("model_version", "N/A"),
        "features_used": features_used,
    }
