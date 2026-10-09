"""
NeuroScreen — Cognitive Benchmarks API Endpoints
=================================================
Endpoints for saving and retrieving Cognitive Lab benchmarks.
Supports user self-tracking and administrator surveillance.
"""

from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import TokenData, get_current_user, require_admin
from app.repositories.benchmark_repository import BenchmarkRepository
from app.schemas.benchmark import (
    BenchmarkCreate,
    BenchmarkResponse,
    UserBenchmarkBest,
    UserBenchmarkProfile,
    AdminBenchmarkOverview,
)

router = APIRouter(prefix="/benchmarks", tags=["Cognitive Benchmarks"])


# -------------------------------------------------------
# User Endpoints
# -------------------------------------------------------

@router.post(
    "",
    response_model=BenchmarkResponse,
    summary="Record Benchmark Test Result",
    description="Save a completed Cognitive Lab test attempt for the authenticated user.",
)
async def record_benchmark(
    data: BenchmarkCreate,
    user: TokenData = Depends(get_current_user),
):
    from app.core.supabase_client import get_supabase_admin
    supabase = get_supabase_admin()
    if supabase:
        try:
            prof = supabase.table("profiles").select("role").eq("id", user.user_id).single().execute()
            if prof.data and prof.data.get("role") == "ADMIN":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Administrators cannot record benchmark test attempts.",
                )
        except HTTPException:
            raise
        except Exception:
            pass

    return BenchmarkRepository.record_benchmark(user.user_id, data)


@router.get(
    "/my-bests",
    response_model=Dict[str, UserBenchmarkBest],
    summary="Get Current User's Personal Bests",
    description="Returns personal bests across all 6 cognitive benchmark tests for the authenticated user.",
)
async def get_my_bests(
    user: TokenData = Depends(get_current_user),
):
    return BenchmarkRepository.get_user_bests(user.user_id)


@router.get(
    "/my-history",
    response_model=List[BenchmarkResponse],
    summary="Get Current User's Benchmark History",
    description="Returns recent benchmark test attempts for the authenticated user.",
)
async def get_my_history(
    limit: int = Query(25, ge=1, le=100),
    user: TokenData = Depends(get_current_user),
):
    return BenchmarkRepository.get_user_history(user.user_id, limit=limit)


# -------------------------------------------------------
# Admin Surveillance Endpoints
# -------------------------------------------------------

@router.get(
    "/admin/overview",
    response_model=AdminBenchmarkOverview,
    summary="Get Platform-Wide Benchmark Overview (Admin)",
    description="Returns aggregate cognitive performance stats across all patient benchmarks.",
)
async def get_admin_benchmark_overview(
    admin: TokenData = Depends(require_admin),
):
    return BenchmarkRepository.get_admin_overview()


@router.get(
    "/admin/users",
    response_model=List[UserBenchmarkProfile],
    summary="List Patient Benchmark Profiles (Admin)",
    description="Returns all users with their Cognitive Lab personal bests and activity dates.",
)
async def list_admin_benchmark_users(
    admin: TokenData = Depends(require_admin),
):
    return BenchmarkRepository.get_admin_all_profiles()


@router.get(
    "/admin/user/{user_id}",
    response_model=UserBenchmarkProfile,
    summary="Get Patient Benchmark Dossier (Admin)",
    description="Returns full benchmark attempt history and reflexes breakdown for a specific user.",
)
async def get_admin_user_benchmarks(
    user_id: str,
    admin: TokenData = Depends(require_admin),
):
    profile = BenchmarkRepository.get_admin_user_profile(user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User benchmark profile '{user_id}' not found.",
        )
    return profile
