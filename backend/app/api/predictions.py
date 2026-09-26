"""
NeuroScreen — Prediction API Endpoints
=========================================
Triggers ML screening predictions for completed assessments.

Flow:
  1. Fetch all completed module results for the assessment
  2. Fuse features via predictor service
  3. Persist prediction to the predictions table
  4. Return result with mandatory disclaimer

IMPORTANT: Predictions are Behavioural Screening Levels (LOW/MODERATE/HIGH).
They are NOT medical diagnoses. Never call the distribution "probability".

Research/Educational Prototype — trained and evaluated on synthetic data.
Not clinically validated.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import TokenData, get_current_user
from app.core.supabase_client import get_supabase_admin
from app.core.exceptions import (
    NotFoundException,
    BadRequestException,
    ConflictException,
    ServiceUnavailableException,
)
from app.ml.predictor import predict_screening
from app.ml.model_loader import get_model_loader

logger = logging.getLogger("neuroscreen.api.predictions")

router = APIRouter(prefix="/predictions", tags=["Predictions"])

DISCLAIMER_TEXT = (
    "This application is intended for behavioural screening and "
    "educational/research purposes only. It is NOT a medical diagnosis "
    "and cannot replace evaluation by a qualified healthcare professional."
)
PROTOTYPE_TEXT = (
    "Research/Educational Prototype — trained and evaluated on synthetic data. "
    "Not clinically validated."
)


def _get_db():
    """Get Supabase client or raise if not configured."""
    supabase = get_supabase_admin()
    if not supabase:
        raise ServiceUnavailableException("Database service not configured.")
    return supabase


def _format_prediction(row: dict) -> dict:
    """Ensure module_scores, disclaimer, and prototype notice are set."""
    res = dict(row)
    if not res.get("module_scores"):
        res["module_scores"] = res.get("features_used", {}).get("_module_scores", {})
    res["disclaimer"] = DISCLAIMER_TEXT
    res["prototype_notice"] = PROTOTYPE_TEXT
    return res


# Module type → list of expected feature keys
MODULE_FEATURE_KEYS = {
    "typing": ["wpm", "cpm", "accuracy", "backspace_rate", "avg_hold_time_ms", "avg_flight_time_ms"],
    "memory": ["word_recall_accuracy", "number_recall_accuracy", "pattern_accuracy", "avg_response_time_ms"],
    "reaction": ["avg_reaction_time_ms", "fastest_reaction_ms", "slowest_reaction_ms", "false_start_count"],
    "speech": ["speech_rate_wpm", "avg_pause_duration_ms", "fluency_score", "transcript_word_count"],
    "facial": ["blink_rate_per_min", "avg_head_movement", "orientation_stability", "attention_score"],
}


# -------------------------------------------------------
# POST — Run Prediction
# -------------------------------------------------------

@router.post(
    "/assessments/{assessment_id}/predict",
    status_code=status.HTTP_201_CREATED,
    summary="Run ML Screening Prediction",
    description=(
        "Runs the ML screening prediction for a completed assessment. "
        "Fetches all completed module results, fuses features, runs the "
        "loaded model, and persists the prediction.\n\n"
        "⚠️ Disclaimer: This is NOT a medical diagnosis. Results represent "
        "a Behavioural Screening Level based on synthetic-data-trained models."
    ),
)
async def run_prediction(
    assessment_id: str,
    user: TokenData = Depends(get_current_user),
):
    """
    Run ML screening prediction for an assessment.

    Steps:
      1. Verify assessment belongs to user
      2. Check no existing prediction (avoid duplicates)
      3. Fetch completed module results
      4. Build module_results dict for predictor
      5. Call predict_screening()
      6. Persist to predictions table
      7. Return result with disclaimer
    """
    db = _get_db()

    # --- Check ML model is loaded ---
    loader = get_model_loader()
    if not loader.is_loaded:
        raise ServiceUnavailableException(
            "ML model is not currently loaded. Prediction service unavailable."
        )

    # --- Verify assessment belongs to user ---
    assessment = (
        db.table("assessments")
        .select("id, status, user_id")
        .eq("id", assessment_id)
        .eq("user_id", user.user_id)
        .single()
        .execute()
    )

    if not assessment.data:
        raise NotFoundException("Assessment", assessment_id)

    # --- Check for existing prediction ---
    existing = (
        db.table("predictions")
        .select("*")
        .eq("assessment_id", assessment_id)
        .execute()
    )
    if existing.data:
        return _format_prediction(existing.data[0])

    # --- Fetch completed module results ---
    modules_result = (
        db.table("module_results")
        .select("module_type, status, features")
        .eq("assessment_id", assessment_id)
        .execute()
    )

    if not modules_result.data:
        raise BadRequestException(
            "No module results found for this assessment. "
            "Complete at least one assessment module before requesting a prediction."
        )

    # --- Build module_results dict for predictor ---
    module_results: dict = {
        "typing": None,
        "memory": None,
        "reaction": None,
        "speech": None,
        "facial": None,
    }

    for row in modules_result.data:
        module_type = row.get("module_type")
        module_status = row.get("status")
        features = row.get("features", {})

        if module_type in module_results and module_status == "completed" and features:
            module_results[module_type] = features

    # Verify at least one module is completed
    if not any(v is not None for v in module_results.values()):
        raise BadRequestException(
            "At least one assessment module must be completed with valid features. "
            "Skipped modules cannot be used for prediction alone."
        )

    # --- Run prediction ---
    try:
        prediction_result = predict_screening(module_results)
    except ValueError as e:
        raise BadRequestException(str(e))
    except RuntimeError as e:
        logger.error(f"ML prediction failed for assessment {assessment_id}: {e}")
        raise ServiceUnavailableException(
            "ML prediction service encountered an error. Please try again later."
        )
    except Exception as e:
        logger.error(f"Unexpected error during prediction for {assessment_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during prediction.",
        )

    # --- Persist prediction ---
    # Store module_scores inside features_used['_module_scores'] to match DB schema
    features_with_scores = dict(prediction_result.get("features_used", {}))
    features_with_scores["_module_scores"] = prediction_result.get("module_scores", {})

    insert_data = {
        "assessment_id": assessment_id,
        "model_version": prediction_result.get("model_version", "unknown"),
        "model_name": prediction_result.get("model_name", "unknown"),
        "screening_level": prediction_result["screening_level"],
        "overall_score": prediction_result.get("overall_score"),
        "model_distribution": prediction_result.get("model_distribution", {}),
        "features_used": features_with_scores,
        "modalities_present": prediction_result.get("modalities_present", {}),
    }

    try:
        result = db.table("predictions").insert(insert_data).execute()
    except Exception as e:
        error_msg = str(e)
        if "uq_prediction_per_assessment" in error_msg or "duplicate" in error_msg.lower():
            raise ConflictException(
                "A prediction already exists for this assessment."
            )
        logger.error(f"Failed to persist prediction for {assessment_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save prediction results.",
        )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save prediction results.",
        )

    return _format_prediction(result.data[0])


# -------------------------------------------------------
# GET — Latest Prediction (for dashboard overview)
# -------------------------------------------------------

@router.get(
    "/latest",
    summary="Get Latest Prediction",
    description=(
        "Returns the current user's most recent ML screening prediction. "
        "Used by the dashboard overview to show the latest screening result.\n\n"
        "⚠️ This is NOT a medical diagnosis."
    ),
)
async def get_latest_prediction(
    user: TokenData = Depends(get_current_user),
):
    """
    Fetch the user's most recent prediction by joining predictions
    with assessments (to filter by user_id).
    """
    db = _get_db()

    # Get user's assessments ordered by creation date
    assessments = (
        db.table("assessments")
        .select("id")
        .eq("user_id", user.user_id)
        .order("created_at", desc=True)
        .execute()
    )

    if not assessments.data:
        raise NotFoundException("Prediction", "No assessments found for user")

    # Find the latest prediction across the user's assessments
    assessment_ids = [a["id"] for a in assessments.data]

    prediction = (
        db.table("predictions")
        .select("*")
        .in_("assessment_id", assessment_ids)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not prediction.data:
        raise NotFoundException("Prediction", "No predictions found for user")

    return _format_prediction(prediction.data[0])


# -------------------------------------------------------
# GET — Prediction History (for score trends chart)
# -------------------------------------------------------

@router.get(
    "/history",
    summary="Get Prediction History",
    description=(
        "Returns all predictions for the current user, ordered by date. "
        "Used by the score trends chart to show how scores change over time.\n\n"
        "⚠️ This is NOT a medical diagnosis."
    ),
)
async def get_prediction_history(
    user: TokenData = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of predictions to return"),
):
    """
    Fetch all predictions for the current user's assessments,
    ordered by creation date (oldest first for charting).
    """
    db = _get_db()

    # Get user's assessments
    assessments = (
        db.table("assessments")
        .select("id")
        .eq("user_id", user.user_id)
        .execute()
    )

    if not assessments.data:
        return []

    assessment_ids = [a["id"] for a in assessments.data]

    # Fetch predictions for those assessments
    predictions = (
        db.table("predictions")
        .select("id, assessment_id, screening_level, overall_score, features_used, model_name, created_at")
        .in_("assessment_id", assessment_ids)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )

    history = []
    for p in (predictions.data or []):
        item = dict(p)
        item["module_scores"] = item.get("features_used", {}).get("_module_scores", {})
        history.append(item)

    return history

