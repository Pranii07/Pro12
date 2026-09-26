"""
NeuroScreen — Auth API Endpoints
==================================
Endpoints for user profile retrieval and update.
Authentication is handled by Supabase Auth (frontend) — these endpoints
only verify the JWT and return/update profile data.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import TokenData, get_current_user
from app.core.supabase_client import get_supabase_admin
from app.core.exceptions import NotFoundException, ServiceUnavailableException
from app.schemas.auth import ProfileResponse, ProfileUpdate
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get(
    "/me",
    response_model=ProfileResponse,
    summary="Get Current User Profile",
    description="Returns the authenticated user's profile information.",
)
async def get_me(user: TokenData = Depends(get_current_user)):
    """Fetch the current user's profile from the database."""
    supabase = get_supabase_admin()
    if not supabase:
        raise ServiceUnavailableException("Database service not configured.")

    try:
        result = (
            supabase.table("profiles")
            .select("*")
            .eq("id", user.user_id)
            .single()
            .execute()
        )
    except Exception as e:
        raise NotFoundException("Profile", user.user_id)

    if not result.data:
        raise NotFoundException("Profile", user.user_id)

    return ProfileResponse(
        id=result.data["id"],
        email=user.email,
        full_name=result.data.get("full_name", ""),
        role=result.data.get("role", "USER"),
        language_preference=result.data.get("language_preference", "en"),
        avatar_url=result.data.get("avatar_url"),
        created_at=result.data["created_at"],
        updated_at=result.data["updated_at"],
    )


@router.patch(
    "/me",
    response_model=ProfileResponse,
    summary="Update Current User Profile",
    description="Update the authenticated user's profile. Cannot change role.",
)
async def update_me(
    updates: ProfileUpdate,
    user: TokenData = Depends(get_current_user),
):
    """Update the current user's profile."""
    supabase = get_supabase_admin()
    if not supabase:
        raise ServiceUnavailableException("Database service not configured.")

    # Build update dict, excluding None values
    update_data = updates.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update.",
        )

    try:
        result = (
            supabase.table("profiles")
            .update(update_data)
            .eq("id", user.user_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update profile: {e}",
        )

    if not result.data:
        raise NotFoundException("Profile", user.user_id)

    data = result.data[0]
    return ProfileResponse(
        id=data["id"],
        email=user.email,
        full_name=data.get("full_name", ""),
        role=data.get("role", "USER"),
        language_preference=data.get("language_preference", "en"),
        avatar_url=data.get("avatar_url"),
        created_at=data["created_at"],
        updated_at=data["updated_at"],
    )
