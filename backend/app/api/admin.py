"""
NeuroScreen — Admin API Endpoints
====================================
Admin-only endpoints for managing users, assessments, and viewing ML model info.
All endpoints require ADMIN role (verified server-side).

The admin dashboard is READ-ONLY for ML model info — no retrain-from-UI button.
"""

import json
import os
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException, status

from app.core.security import TokenData, require_admin, get_current_user
from app.core.supabase_client import get_supabase_admin
from app.core.config import Settings, get_settings
from app.core.exceptions import ServiceUnavailableException, NotFoundException
from app.schemas.auth import ProfileResponse, UserWithStats, UserAdminUpdate
from app.schemas.assessment import AssessmentSummary
from app.schemas.prediction import ModelMetadataResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


def _get_db():
    """Get Supabase client or raise if not configured."""
    supabase = get_supabase_admin()
    if not supabase:
        raise ServiceUnavailableException("Database service not configured.")
    return supabase


# -------------------------------------------------------
# Users Management
# -------------------------------------------------------

@router.get(
    "/users",
    response_model=list[UserWithStats],
    summary="List All Users (Admin)",
    description="Returns all registered users with their emails and assessment statistics.",
)
async def list_users(
    admin: TokenData = Depends(require_admin),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    db = _get_db()

    # Map user emails from auth.users
    email_map = {}
    try:
        auth_users = db.auth.admin.list_users()
        for u in auth_users:
            email_map[str(u.id)] = u.email
    except Exception:
        pass

    result = (
        db.table("profiles")
        .select("*, assessments(id, status, created_at)")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    from app.repositories.benchmark_repository import BenchmarkRepository
    cog_counts = BenchmarkRepository.get_users_test_counts()

    users = []
    for row in result.data or []:
        assessments = row.pop("assessments", [])
        total = len(assessments)
        completed = sum(1 for a in assessments if a.get("status") == "completed")
        last_assessment = None
        if assessments:
            sorted_assessments = sorted(assessments, key=lambda x: x.get("created_at", ""), reverse=True)
            last_assessment = sorted_assessments[0].get("created_at")

        user_id_str = str(row["id"])
        users.append(UserWithStats(
            id=user_id_str,
            email=email_map.get(user_id_str),
            full_name=row.get("full_name", ""),
            role=row.get("role", "USER"),
            language_preference=row.get("language_preference", "en"),
            avatar_url=row.get("avatar_url"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            total_assessments=total,
            completed_assessments=completed,
            cognitive_tests=cog_counts.get(user_id_str, 0),
            last_assessment_at=last_assessment,
        ))

    return users


@router.patch(
    "/users/{user_id}",
    response_model=ProfileResponse,
    summary="Update User (Admin)",
    description="Update user profile information including role, name, or language preference.",
)
async def update_user(
    user_id: str,
    body: UserAdminUpdate,
    admin: TokenData = Depends(require_admin),
):
    db = _get_db()

    update_data = {}
    if body.full_name is not None:
        update_data["full_name"] = body.full_name
    if body.role is not None:
        update_data["role"] = body.role.value
    if body.language_preference is not None:
        update_data["language_preference"] = body.language_preference.value

    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided to update.")

    update_data["updated_at"] = "now()"

    result = db.table("profiles").update(update_data).eq("id", user_id).execute()
    if not result.data:
        raise NotFoundException("User", user_id)

    # Get email
    email = None
    try:
        user_auth = db.auth.admin.get_user_by_id(user_id)
        email = user_auth.user.email if user_auth and user_auth.user else None
    except Exception:
        pass

    data = result.data[0]
    data["email"] = email
    return ProfileResponse(**data)


@router.delete(
    "/users/{user_id}",
    summary="Delete User (Admin)",
    description="Delete a user profile and all their associated assessments and data.",
)
async def delete_user(
    user_id: str,
    admin: TokenData = Depends(require_admin),
):
    if user_id == admin.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own active admin account.",
        )

    db = _get_db()

    # Verify user exists
    existing = db.table("profiles").select("id").eq("id", user_id).execute()
    if not existing.data:
        raise NotFoundException("User", user_id)

    # Delete from profiles (cascades to assessments, reports, etc.)
    db.table("profiles").delete().eq("id", user_id).execute()

    # Try deleting from auth.users as well
    try:
        db.auth.admin.delete_user(user_id)
    except Exception:
        pass

    return {"message": "User deleted successfully", "id": user_id}


@router.get(
    "/users/{user_id}/details",
    summary="Get User Dossier (Admin)",
    description="Returns detailed records for a specific user including assessments, screening results, and reports.",
)
async def get_user_details(
    user_id: str,
    admin: TokenData = Depends(require_admin),
):
    db = _get_db()
    profile_res = db.table("profiles").select("*").eq("id", user_id).execute()
    if not profile_res.data:
        raise NotFoundException("User", user_id)

    profile = profile_res.data[0]
    # Get user email
    try:
        user_auth = db.auth.admin.get_user_by_id(user_id)
        profile["email"] = user_auth.user.email if user_auth and user_auth.user else None
    except Exception:
        profile["email"] = None

    # Get assessments with module results and predictions
    assessments_res = (
        db.table("assessments")
        .select("*, module_results(*), predictions(*)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    # Get reports
    reports_res = (
        db.table("reports")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    return {
        "profile": profile,
        "assessments": assessments_res.data or [],
        "reports": reports_res.data or [],
    }


@router.post(
    "/claim-admin",
    summary="Claim Admin Role (Demo / Setup)",
    description="Promotes the currently authenticated user to ADMIN for testing and evaluation.",
)
async def claim_admin(user: TokenData = Depends(get_current_user)):
    db = _get_db()
    res = db.table("profiles").update({"role": "ADMIN"}).eq("id", user.user_id).execute()
    if not res.data:
        raise NotFoundException("User", user.user_id)
    return {"message": "Admin role granted successfully", "role": "ADMIN"}



# -------------------------------------------------------
# Assessments (all users)
# -------------------------------------------------------

@router.get(
    "/assessments",
    response_model=list[AssessmentSummary],
    summary="List All Assessments (Admin)",
    description="Returns all assessments across all users.",
)
async def list_all_assessments(
    admin: TokenData = Depends(require_admin),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    db = _get_db()

    query = (
        db.table("assessments")
        .select("*, module_results(id, status), predictions(screening_level)")
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


# -------------------------------------------------------
# Dashboard Statistics
# -------------------------------------------------------

@router.get(
    "/stats",
    summary="Dashboard Statistics (Admin)",
    description="Returns aggregate statistics for the admin dashboard.",
)
async def get_stats(admin: TokenData = Depends(require_admin)):
    db = _get_db()

    # Total users
    users_result = db.table("profiles").select("id", count="exact").execute()
    total_users = users_result.count or 0

    # Total assessments
    assessments_result = db.table("assessments").select("id", count="exact").execute()
    total_assessments = assessments_result.count or 0

    # Completed assessments
    completed_result = (
        db.table("assessments")
        .select("id", count="exact")
        .eq("status", "completed")
        .execute()
    )
    completed_assessments = completed_result.count or 0

    # Predictions by screening level
    predictions_result = db.table("predictions").select("screening_level").execute()
    level_counts = {"LOW": 0, "MODERATE": 0, "HIGH": 0}
    for p in predictions_result.data or []:
        level = p.get("screening_level")
        if level in level_counts:
            level_counts[level] += 1

    # Total reports
    reports_result = db.table("reports").select("id", count="exact").execute()
    total_reports = reports_result.count or 0

    return {
        "total_users": total_users,
        "total_assessments": total_assessments,
        "completed_assessments": completed_assessments,
        "total_reports": total_reports,
        "screening_distribution": level_counts,
        "prototype_notice": (
            "Research/Educational Prototype — trained and evaluated on "
            "synthetic data. Not clinically validated."
        ),
    }


# -------------------------------------------------------
# ML Model Info (Read-Only)
# -------------------------------------------------------

@router.get(
    "/model-info",
    response_model=ModelMetadataResponse,
    summary="ML Model Metadata (Admin, Read-Only)",
    description=(
        "Returns metadata about the currently loaded ML model. "
        "This is read-only — there is no retrain-from-UI capability."
    ),
)
async def get_model_info(
    admin: TokenData = Depends(require_admin),
    settings: Settings = Depends(get_settings),
):
    """Read model metadata from the exported JSON file (if it exists)."""
    metadata_path = settings.ml_model_metadata_path

    if not os.path.exists(metadata_path):
        return ModelMetadataResponse()  # defaults with "Not loaded"

    try:
        with open(metadata_path, "r") as f:
            metadata = json.load(f)

        return ModelMetadataResponse(
            model_name=metadata.get("model_name", "Unknown"),
            model_version=metadata.get("model_version", "N/A"),
            training_date=metadata.get("training_date"),
            dataset_description=metadata.get("dataset_description", "Not specified"),
            feature_schema=metadata.get("feature_schema", {}),
            metrics=metadata.get("metrics", {}),
        )
    except Exception:
        return ModelMetadataResponse()
