"""
NeuroScreen — Media Processing Schemas
=========================================
Pydantic schemas for speech and facial media processing responses.

These schemas define the feature vectors extracted server-side from
transient audio/video uploads. Raw media is never persisted — only
the numeric features described here are stored.
"""

from __future__ import annotations

from typing import Optional, Dict
from pydantic import BaseModel, Field


# -------------------------------------------------------
# Speech Processing
# -------------------------------------------------------

class SpeechFeaturesResponse(BaseModel):
    """
    Features extracted from a speech audio sample.

    The raw audio is processed in-memory and discarded immediately
    after feature extraction. Only these numeric features are returned.
    """
    speech_rate_wpm: float = Field(
        description="Estimated words per minute from the transcript."
    )
    avg_pause_duration_ms: float = Field(
        description="Average duration of detected silence gaps in milliseconds."
    )
    fluency_score: float = Field(
        ge=0, le=100,
        description="Ratio of speech time to total recording time (0-100)."
    )
    transcript: str = Field(
        default="",
        description="Speech-to-text transcript (best-effort, may be empty if STT model unavailable)."
    )
    duration_seconds: float = Field(
        description="Total duration of the audio recording in seconds."
    )
    processing_note: str = Field(
        default="",
        description="Any notes about processing (e.g., 'Vosk model not available — transcript unavailable')."
    )


class SpeechUploadResponse(BaseModel):
    """Response wrapper for the speech upload endpoint."""
    success: bool = True
    features: SpeechFeaturesResponse
    score: float = Field(
        ge=0, le=100,
        description="Behavioural speech score (0-100)."
    )
    disclaimer: str = Field(
        default=(
            "This application is intended for behavioural screening and "
            "educational/research purposes only. It is NOT a medical diagnosis "
            "and cannot replace evaluation by a qualified healthcare professional."
        )
    )


# -------------------------------------------------------
# Facial Processing
# -------------------------------------------------------

class EmotionIndicators(BaseModel):
    """
    Experimental emotion indicators derived from facial landmarks.

    ⚠️ EXPERIMENTAL / NON-DIAGNOSTIC — these are rough approximations
    from landmark geometry, NOT validated emotion detection. They are
    never treated as a screening signal and are for display purposes only.
    """
    smile_likelihood: float = Field(
        default=0.0, ge=0, le=1,
        description="Rough smile likelihood from mouth landmarks (0-1). EXPERIMENTAL."
    )
    label: str = Field(
        default="Experimental / Non-diagnostic",
        description="Mandatory label for emotion indicators."
    )


class FacialFeaturesResponse(BaseModel):
    """
    Features extracted from a facial video frame burst.

    Raw frames are processed in-memory and discarded immediately
    after feature extraction. Only these numeric features are returned.
    """
    blink_rate_per_minute: float = Field(
        description="Detected blinks extrapolated to per-minute rate."
    )
    avg_head_movement: float = Field(
        description="Average frame-to-frame landmark displacement (pixels, normalized)."
    )
    head_orientation_stability: float = Field(
        ge=0, le=100,
        description="Head pose stability score (0-100, higher = more stable)."
    )
    attention_score: float = Field(
        ge=0, le=100,
        description="Percentage of frames where face is detected and oriented toward camera."
    )
    frames_processed: int = Field(
        description="Number of frames successfully processed."
    )
    capture_duration_seconds: float = Field(
        description="Total capture duration in seconds."
    )
    emotion_indicators: Optional[EmotionIndicators] = Field(
        default=None,
        description="Experimental emotion indicators. NOT used for screening. Display-only."
    )
    processing_note: str = Field(
        default="",
        description="Any notes about processing."
    )


class FacialUploadResponse(BaseModel):
    """Response wrapper for the facial upload endpoint."""
    success: bool = True
    features: FacialFeaturesResponse
    score: float = Field(
        ge=0, le=100,
        description="Behavioural facial analysis score (0-100)."
    )
    disclaimer: str = Field(
        default=(
            "This application is intended for behavioural screening and "
            "educational/research purposes only. It is NOT a medical diagnosis "
            "and cannot replace evaluation by a qualified healthcare professional."
        )
    )
