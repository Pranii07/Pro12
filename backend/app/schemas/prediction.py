"""
NeuroScreen — Prediction Schemas
===================================
Pydantic schemas for ML screening predictions.

IMPORTANT: Predictions represent Behavioural Screening Levels (LOW/MODERATE/HIGH).
They are NOT medical diagnoses and never represent disease probability.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Dict, Any
from enum import Enum

from pydantic import BaseModel, Field


# -------------------------------------------------------
# Enums
# -------------------------------------------------------

class ScreeningLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"


# -------------------------------------------------------
# Prediction Schemas
# -------------------------------------------------------

class PredictionResponse(BaseModel):
    """
    ML screening prediction result.

    This is NOT a medical diagnosis. It represents a Behavioural Screening Level
    based on the user's assessment data, evaluated by a model trained on synthetic data.

    Disclaimer: Research/Educational Prototype — trained and evaluated on synthetic data.
    Not clinically validated.
    """
    id: str
    assessment_id: str
    model_version: str
    model_name: str
    screening_level: ScreeningLevel = Field(
        description="Behavioural Screening Level: LOW, MODERATE, or HIGH. NOT a disease diagnosis."
    )
    overall_score: Optional[float] = Field(
        None, ge=0, le=100,
        description="Overall behavioural score (0-100)"
    )
    model_distribution: Dict[str, float] = Field(
        default_factory=dict,
        description=(
            "Model screening distribution across levels. "
            "Never called 'probability'. "
            "Example: {'LOW': 0.65, 'MODERATE': 0.25, 'HIGH': 0.10}"
        ),
    )
    module_scores: Dict[str, Optional[float]] = Field(
        default_factory=dict,
        description=(
            "Per-module normalized scores (0-100). "
            "None for skipped modules. "
            "Example: {'typing': 72.5, 'memory': null, 'reaction': 58.0, ...}"
        ),
    )
    modalities_present: Dict[str, bool] = Field(
        default_factory=dict,
        description="Which assessment modules were completed (true) vs skipped (false)."
    )
    created_at: datetime
    disclaimer: str = Field(
        default=(
            "This application is intended for behavioural screening and "
            "educational/research purposes only. It is NOT a medical diagnosis "
            "and cannot replace evaluation by a qualified healthcare professional."
        ),
        description="Mandatory disclaimer included with every prediction."
    )


# -------------------------------------------------------
# Prediction History (for score trends chart)
# -------------------------------------------------------

class PredictionHistoryItem(BaseModel):
    """
    Lightweight prediction summary for the score trends chart.
    """
    id: str
    assessment_id: str
    screening_level: ScreeningLevel
    overall_score: Optional[float] = None
    module_scores: Dict[str, Optional[float]] = Field(default_factory=dict)
    model_name: str = "Unknown"
    created_at: datetime


# -------------------------------------------------------
# Model Metadata (for admin dashboard — read-only)
# -------------------------------------------------------

class ModelMetadataResponse(BaseModel):
    """
    Read-only metadata about the currently loaded ML model.
    Displayed in the admin dashboard. Does NOT trigger retraining.
    """
    model_name: str = "Not loaded"
    model_version: str = "N/A"
    training_date: Optional[str] = None
    dataset_description: str = "No model loaded"
    feature_schema: Dict[str, Any] = Field(default_factory=dict)
    metrics: Dict[str, Any] = Field(default_factory=dict)
    prototype_notice: str = Field(
        default="Research/Educational Prototype — trained and evaluated on synthetic data. Not clinically validated."
    )
