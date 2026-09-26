"""
NeuroScreen — Assessment API Endpoints
=========================================
CRUD endpoints for assessment sessions and module results.
All endpoints require JWT authentication.
Users can only access their own assessments (enforced server-side + RLS).
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import TokenData, get_current_user
from app.core.supabase_client import get_supabase_admin
from app.core.exceptions import (
    NotFoundException,
    BadRequestException,
    ConflictException,
    ServiceUnavailableException,
)
from app.schemas.assessment import (
    AssessmentCreate,
    AssessmentUpdate,
    AssessmentResponse,
    AssessmentWithModules,
    AssessmentSummary,
    ModuleResultCreate,
    ModuleResultResponse,
)
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/assessments", tags=["Assessments"])


def _get_db():
    """Get Supabase client or raise if not configured."""
    supabase = get_supabase_admin()
    if not supabase:
        raise ServiceUnavailableException("Database service not configured.")
    return supabase


# -------------------------------------------------------
# Assessment CRUD
# -------------------------------------------------------

@router.post(
    "",
    response_model=AssessmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Assessment Session",
    description="Start a new assessment session. Only one in-progress assessment per user is allowed.",
)
async def create_assessment(
    body: AssessmentCreate,
    abandon_existing: bool = Query(False, description="Abandon any existing in-progress assessment before creating a new one"),
    user: TokenData = Depends(get_current_user),
):
    db = _get_db()

    # Check for existing in-progress assessment
    existing = (
        db.table("assessments")
        .select("id")
        .eq("user_id", user.user_id)
        .eq("status", "in_progress")
        .execute()
    )
    if existing.data:
        if abandon_existing:
            for item in existing.data:
                db.table("assessments").update({"status": "abandoned"}).eq("id", item["id"]).execute()
        else:
            raise ConflictException(
                "You already have an in-progress assessment. "
                "Complete or abandon it before starting a new one."
            )

    # Create assessment
    result = (
        db.table("assessments")
        .insert({
            "user_id": user.user_id,
            "language": body.language,
            "status": "in_progress",
        })
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create assessment.",
        )

    data = result.data[0]
    return AssessmentResponse(**data)


@router.get(
    "",
    response_model=list[AssessmentSummary],
    summary="List User's Assessments",
    description="Returns the current user's assessment history, ordered by most recent first.",
)
async def list_assessments(
    user: TokenData = Depends(get_current_user),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    db = _get_db()

    query = (
        db.table("assessments")
        .select("*, module_results(id, status), predictions(screening_level)")
        .eq("user_id", user.user_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )

    if status_filter:
        query = query.eq("status", status_filter)

    result = query.execute()

    summaries = []
    for row in result.data or []:
        modules = row.get("module_results", [])
        modules_completed = sum(1 for m in modules if m.get("status") == "completed")

        predictions = row.get("predictions")
        screening = None
        if isinstance(predictions, dict):
            screening = predictions.get("screening_level")
        elif isinstance(predictions, list) and len(predictions) > 0:
            screening = predictions[0].get("screening_level")


        summaries.append(AssessmentSummary(
            id=row["id"],
            language=row["language"],
            status=row["status"],
            started_at=row["started_at"],
            completed_at=row.get("completed_at"),
            modules_completed=modules_completed,
            modules_total=5,
            screening_level=screening,
        ))

    return summaries


@router.get(
    "/{assessment_id}",
    response_model=AssessmentWithModules,
    summary="Get Assessment Details",
    description="Returns a specific assessment with all its module results.",
)
async def get_assessment(
    assessment_id: str,
    user: TokenData = Depends(get_current_user),
):
    db = _get_db()

    result = (
        db.table("assessments")
        .select("*, module_results(*)")
        .eq("id", assessment_id)
        .eq("user_id", user.user_id)
        .single()
        .execute()
    )

    if not result.data:
        raise NotFoundException("Assessment", assessment_id)

    data = result.data
    module_results = [
        ModuleResultResponse(**m) for m in data.pop("module_results", [])
    ]

    return AssessmentWithModules(
        **data,
        module_results=module_results,
    )


@router.patch(
    "/{assessment_id}",
    response_model=AssessmentResponse,
    summary="Update Assessment Status",
    description="Update the status of an assessment (e.g., mark as completed or abandoned).",
)
async def update_assessment(
    assessment_id: str,
    body: AssessmentUpdate,
    user: TokenData = Depends(get_current_user),
):
    db = _get_db()

    update_data = {"status": body.status.value}
    if body.status.value == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

    result = (
        db.table("assessments")
        .update(update_data)
        .eq("id", assessment_id)
        .eq("user_id", user.user_id)
        .execute()
    )

    if not result.data:
        raise NotFoundException("Assessment", assessment_id)

    return AssessmentResponse(**result.data[0])


# -------------------------------------------------------
# Module Results
# -------------------------------------------------------

@router.post(
    "/{assessment_id}/modules",
    response_model=ModuleResultResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit Module Result",
    description=(
        "Submit results for a single assessment module. "
        "Each module type can only be submitted once per assessment."
    ),
)
async def submit_module_result(
    assessment_id: str,
    body: ModuleResultCreate,
    user: TokenData = Depends(get_current_user),
):
    db = _get_db()

    # Verify assessment belongs to user and is in progress
    assessment = (
        db.table("assessments")
        .select("id, status")
        .eq("id", assessment_id)
        .eq("user_id", user.user_id)
        .single()
        .execute()
    )

    if not assessment.data:
        raise NotFoundException("Assessment", assessment_id)

    if assessment.data["status"] != "in_progress":
        raise BadRequestException("Cannot submit modules to a non-active assessment.")

    # Insert module result
    insert_data = {
        "assessment_id": assessment_id,
        "module_type": body.module_type.value,
        "status": body.status.value,
        "features": body.features,
        "score": body.score,
        "duration_seconds": body.duration_seconds,
    }
    if body.status == "completed":
        insert_data["completed_at"] = datetime.now(timezone.utc).isoformat()

    try:
        result = db.table("module_results").insert(insert_data).execute()
    except Exception as e:
        error_msg = str(e)
        if "uq_module_per_assessment" in error_msg or "duplicate" in error_msg.lower():
            raise ConflictException(
                f"Module '{body.module_type.value}' already submitted for this assessment."
            )
        raise

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save module result.",
        )

    return ModuleResultResponse(**result.data[0])


@router.get(
    "/{assessment_id}/prediction",
    summary="Get Assessment Prediction",
    description=(
        "Returns the ML screening prediction for this assessment, if available. "
        "Disclaimer: This is NOT a medical diagnosis."
    ),
)
async def get_assessment_prediction(
    assessment_id: str,
    user: TokenData = Depends(get_current_user),
):
    db = _get_db()

    # Verify assessment belongs to user
    assessment = (
        db.table("assessments")
        .select("id")
        .eq("id", assessment_id)
        .eq("user_id", user.user_id)
        .single()
        .execute()
    )

    if not assessment.data:
        raise NotFoundException("Assessment", assessment_id)

    # Fetch prediction
    prediction = (
        db.table("predictions")
        .select("*")
        .eq("assessment_id", assessment_id)
        .single()
        .execute()
    )

    if not prediction.data:
        raise NotFoundException("Prediction for assessment", assessment_id)

    data = dict(prediction.data)
    if not data.get("module_scores"):
        data["module_scores"] = data.get("features_used", {}).get("_module_scores", {})
    data["disclaimer"] = (
        "This application is intended for behavioural screening and "
        "educational/research purposes only. It is NOT a medical diagnosis "
        "and cannot replace evaluation by a qualified healthcare professional."
    )
    return data

