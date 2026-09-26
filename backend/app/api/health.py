"""
NeuroScreen — Health Check Endpoint
=====================================
Public endpoint for service health monitoring. No authentication required.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.schemas.common import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check",
    description="Returns the current health status of the API server.",
)
async def health_check(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        environment=settings.backend_env,
        timestamp=datetime.now(timezone.utc),
    )
