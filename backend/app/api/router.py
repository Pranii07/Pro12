"""
NeuroScreen — API Router
==========================
Aggregates all API sub-routers into a single router mounted on /api.
"""

from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.assessments import router as assessments_router
from app.api.admin import router as admin_router
from app.api.media import router as media_router
from app.api.predictions import router as predictions_router
from app.api.reports import router as reports_router

# Main API router — all sub-routers are prefixed under /api
api_router = APIRouter(prefix="/api")

# Include sub-routers
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(assessments_router)
api_router.include_router(admin_router)
api_router.include_router(media_router)
api_router.include_router(predictions_router)
api_router.include_router(reports_router)

