"""
NeuroScreen -- Reaction Time Preprocessing & Behavioral Latency Pipeline
========================================================================
Handles feature extraction, validation, outlier suppression, and scaling
for simple visual reaction time and psychomotor vigilance tasks.

Extracts and normalizes the 4 core + 2 derived features:
  - avg_reaction_time_ms: Mean response latency across valid trials
  - fastest_reaction_ms: Best-trial peak alertness latency
  - slowest_reaction_ms: Slowest-trial response (attentional lapse indicator)
  - false_start_count: Anticipatory clicks before stimulus onset
  - response_variability_ms: Standard deviation of reaction times
  - coefficient_of_variation: Ratio of standard deviation to mean (CV = SD / Mean)

Clinically Grounded Latency Classification:
  - LOW Risk: Mean ~240-360ms, CV <= 0.24, 0-1 false starts (Alert, healthy psychomotor speed)
  - MODERATE Risk: Mean ~370-490ms, CV 0.25-0.38, 1-2 false starts (Mild slowing / attentional variability)
  - HIGH Risk: Mean >= 500ms, CV > 0.38, 2+ false starts (Marked psychomotor slowing / attentional lapses)

IMPORTANT ETHICAL & CLINICAL NOTICE:
------------------------------------
This pipeline and its models measure behavioral reaction latencies.
They are part of an educational/research prototype. Reaction times can be
influenced by age, fatigue, device latency, and distractions, and must NOT
be construed as a medical or neurological diagnosis.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional, Union

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger("neuroscreen.reaction.preprocessing")

# -------------------------------------------------------
# Feature & Target Schema
# -------------------------------------------------------

REACTION_FEATURE_COLUMNS = [
    "avg_reaction_time_ms",
    "fastest_reaction_ms",
    "slowest_reaction_ms",
    "false_start_count",
    "response_variability_ms",
    "coefficient_of_variation",
]

CORE_ML_FEATURE_COLUMNS = [
    "avg_reaction_time_ms",
    "fastest_reaction_ms",
    "slowest_reaction_ms",
    "false_start_count",
]

CLASS_NAMES = ["LOW", "MODERATE", "HIGH"]

# Physiological plausibility bounds for web browser visual reaction tests
FEATURE_BOUNDS = {
    "avg_reaction_time_ms": (160.0, 1500.0),
    "fastest_reaction_ms": (120.0, 1000.0),
    "slowest_reaction_ms": (200.0, 2500.0),
    "false_start_count": (0.0, 10.0),
    "response_variability_ms": (5.0, 600.0),
    "coefficient_of_variation": (0.02, 1.5),
}

# -------------------------------------------------------
# Preprocessor Class
# -------------------------------------------------------

class ReactionPreprocessor:
    """
    Preprocessor for reaction time assessment features.
    
    Handles:
      1. Extraction and imputation of reaction features
      2. Domain validation and clipping to physiological bounds
      3. StandardScaler normalization for ML inference
    """

    def __init__(self):
        self.scaler = StandardScaler()
        self.is_fitted = False
        self.medians: dict[str, float] = {}
        self.iqr_bounds: dict[str, tuple[float, float]] = {}

    def fit(self, df: pd.DataFrame) -> "ReactionPreprocessor":
        """Fit scaler and compute reference medians on training data."""
        data = self._clean_dataframe(df)

        for col in REACTION_FEATURE_COLUMNS:
            valid_vals = data[col].dropna()
            self.medians[col] = float(valid_vals.median()) if len(valid_vals) > 0 else 350.0

            # Compute IQR bounds
            q25 = float(valid_vals.quantile(0.25)) if len(valid_vals) > 0 else 250.0
            q75 = float(valid_vals.quantile(0.75)) if len(valid_vals) > 0 else 450.0
            iqr = q75 - q25
            lower_b = max(FEATURE_BOUNDS[col][0], q25 - 2.5 * iqr)
            upper_b = min(FEATURE_BOUNDS[col][1], q75 + 2.5 * iqr)
            self.iqr_bounds[col] = (lower_b, upper_b)

        # Impute missing values with medians
        imputed = data.copy()
        for col in REACTION_FEATURE_COLUMNS:
            imputed[col] = imputed[col].fillna(self.medians[col])

        self.scaler.fit(imputed[REACTION_FEATURE_COLUMNS])
        self.is_fitted = True
        return self

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        """Transform features through clamping, median imputation, and standard scaling."""
        if not self.is_fitted:
            raise RuntimeError("ReactionPreprocessor must be fitted before transforming.")

        data = self._clean_dataframe(df)

        imputed = data.copy()
        for col in REACTION_FEATURE_COLUMNS:
            if col not in imputed.columns:
                imputed[col] = self.medians.get(col, 350.0)
            else:
                bounds = self.iqr_bounds.get(col, FEATURE_BOUNDS[col])
                imputed[col] = imputed[col].clip(lower=bounds[0], upper=bounds[1])
                imputed[col] = imputed[col].fillna(self.medians.get(col, 350.0))

        scaled = self.scaler.transform(imputed[REACTION_FEATURE_COLUMNS])
        return scaled

    def fit_transform(self, df: pd.DataFrame) -> np.ndarray:
        """Fit to data then transform."""
        self.fit(df)
        return self.transform(df)

    def _clean_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Extract and ensure valid column types and derived features."""
        clean = pd.DataFrame(index=df.index)

        for col in ["avg_reaction_time_ms", "fastest_reaction_ms", "slowest_reaction_ms", "false_start_count"]:
            if col in df.columns:
                clean[col] = pd.to_numeric(df[col], errors="coerce")
            else:
                clean[col] = np.nan

        # Derive variability and CV if missing
        if "response_variability_ms" in df.columns:
            clean["response_variability_ms"] = pd.to_numeric(df["response_variability_ms"], errors="coerce")
        else:
            # Estimate variability from spread between slowest and fastest
            clean["response_variability_ms"] = ((clean["slowest_reaction_ms"] - clean["fastest_reaction_ms"]) / 3.0).clip(lower=15.0)

        if "coefficient_of_variation" in df.columns:
            clean["coefficient_of_variation"] = pd.to_numeric(df["coefficient_of_variation"], errors="coerce")
        else:
            clean["coefficient_of_variation"] = (
                clean["response_variability_ms"] / clean["avg_reaction_time_ms"].replace(0, np.nan)
            ).clip(lower=0.05, upper=1.0)

        return clean

    def save(self, filepath: Union[str, Path]) -> None:
        """Serialize fitted preprocessor to disk."""
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, filepath)
        logger.info(f"ReactionPreprocessor saved to {filepath}")

    @classmethod
    def load(cls, filepath: Union[str, Path]) -> "ReactionPreprocessor":
        """Load preprocessor instance from disk."""
        obj = joblib.load(filepath)
        if not isinstance(obj, cls):
            raise TypeError(f"Loaded object is not a ReactionPreprocessor: {type(obj)}")
        return obj


# -------------------------------------------------------
# Standalone Inference Helper
# -------------------------------------------------------

def predict_reaction(
    features: dict[str, Any],
    model_path: Optional[Union[str, Path]] = None,
    preprocessor_path: Optional[Union[str, Path]] = None,
) -> dict[str, Any]:
    """
    Run standalone reaction time classification.
    Returns:
      screening_level: "LOW" | "MODERATE" | "HIGH"
      confidence: float [0.0 - 1.0]
      class_probabilities: dict
      latency_score: float [0 - 100]
    """
    project_root = Path(__file__).resolve().parent.parent.parent
    if model_path is None:
        model_path = project_root / "ml" / "models" / "reaction_model.joblib"
    if preprocessor_path is None:
        preprocessor_path = project_root / "ml" / "models" / "reaction_preprocessor.joblib"

    model = joblib.load(model_path)
    preprocessor = ReactionPreprocessor.load(preprocessor_path)

    df = pd.DataFrame([features])
    X = preprocessor.transform(df)

    probs = model.predict_proba(X)[0]
    pred_idx = int(np.argmax(probs))
    pred_class = CLASS_NAMES[pred_idx]

    # Calculate fair 0-100 latency score
    avg_rt = float(features.get("avg_reaction_time_ms", 350.0))
    cv = float(features.get("coefficient_of_variation", 0.20))
    false_starts = int(features.get("false_start_count", 0))

    if avg_rt <= 260:
        speed_score = 98.0
    elif avg_rt <= 330:
        speed_score = 100.0 - ((avg_rt - 260.0) / 70.0) * 12.0
    elif avg_rt <= 430:
        speed_score = 88.0 - ((avg_rt - 330.0) / 100.0) * 16.0
    elif avg_rt <= 560:
        speed_score = 72.0 - ((avg_rt - 430.0) / 130.0) * 22.0
    else:
        speed_score = max(20.0, 50.0 - ((avg_rt - 560.0) / 200.0) * 25.0)

    if cv <= 0.16:
        consistency_score = 98.0
    elif cv <= 0.26:
        consistency_score = 98.0 - ((cv - 0.16) / 0.10) * 14.0
    elif cv <= 0.40:
        consistency_score = 84.0 - ((cv - 0.26) / 0.14) * 24.0
    else:
        consistency_score = max(20.0, 60.0 - ((cv - 0.40) / 0.30) * 30.0)

    penalty = false_starts * 4.0
    final_score = round(max(0.0, min(100.0, speed_score * 0.60 + consistency_score * 0.40 - penalty)), 1)

    return {
        "screening_level": pred_class,
        "confidence": round(float(probs[pred_idx]), 4),
        "class_probabilities": {name: round(float(p), 4) for name, p in zip(CLASS_NAMES, probs)},
        "latency_score": final_score,
        "features_evaluated": features,
    }
