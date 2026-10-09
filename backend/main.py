"""
NeuroScreen — FastAPI Application Entry Point
================================================
Creates and configures the FastAPI application with:
  - Security middleware (headers, request ID, logging)
  - CORS middleware (origins from config)
  - Global exception handlers
  - API router inclusion
  - Production OpenAPI toggle
  - OpenAPI metadata with disclaimers

Run locally:
    cd backend
    uvicorn main:app --reload --port 8000

Or via Python:
    python main.py
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.middleware import (
    SecurityHeadersMiddleware,
    RequestIDMiddleware,
    RequestLoggingMiddleware,
)
from app.api.router import api_router
from app.ml.model_loader import init_model_loader

# -------------------------------------------------------
# Logging
# -------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("neuroscreen")


# -------------------------------------------------------
# Application Factory
# -------------------------------------------------------

def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    # In production, disable interactive API docs
    docs_url = None if settings.is_production else "/docs"
    redoc_url = None if settings.is_production else "/redoc"
    openapi_url = None if settings.is_production else "/openapi.json"

    application = FastAPI(
        title="NeuroScreen API",
        description=(
            "Behavioural AI Framework for Early Neurological Risk Detection. "
            "REST API for assessment management, ML screening predictions, and report generation.\n\n"
            "⚠️ **Disclaimer:** This application is intended for behavioural screening and "
            "educational/research purposes only. It is NOT a medical diagnosis and cannot "
            "replace evaluation by a qualified healthcare professional.\n\n"
            "⚠️ **Research/Educational Prototype** — trained and evaluated on synthetic data. "
            "Not clinically validated."
        ),
        version="1.0.0",
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
    )

    # --- Security Middleware (outermost = processed first) ---
    # Order matters: RequestID → Logging → SecurityHeaders → CORS → App
    application.add_middleware(RequestLoggingMiddleware)
    application.add_middleware(
        SecurityHeadersMiddleware,
        is_production=settings.is_production,
    )
    application.add_middleware(RequestIDMiddleware)

    # --- CORS ---
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    # --- Exception Handlers ---
    register_exception_handlers(application)

    # --- Routers ---
    from app.api.health import health_check
    application.add_api_route(
        "/health",
        health_check,
        methods=["GET"],
        summary="Root Health Check",
        description="Root convenience health check route mirroring /api/health.",
        tags=["Health"],
    )
    application.include_router(api_router)

    # --- Startup Event ---
    @application.on_event("startup")
    async def startup_event():
        logger.info("=" * 60)
        logger.info("NeuroScreen API starting up")
        logger.info(f"  Environment: {settings.backend_env}")
        logger.info(f"  CORS origins: {settings.cors_origin_list}")
        logger.info(f"  Supabase configured: {bool(settings.supabase_url)}")
        logger.info(f"  JWT secret configured: {bool(settings.supabase_jwt_secret)}")
        logger.info(f"  OpenAPI docs: {'disabled (production)' if settings.is_production else 'enabled'}")

        # Enforce required production configuration fail-fast
        if settings.is_production:
            missing_vars: list[str] = []
            if not settings.supabase_url:
                missing_vars.append("SUPABASE_URL")
            if not settings.supabase_service_role_key:
                missing_vars.append("SUPABASE_SERVICE_ROLE_KEY")
            if not settings.supabase_jwt_secret:
                missing_vars.append("SUPABASE_JWT_SECRET")

            if missing_vars:
                error_msg = (
                    "CRITICAL: Application startup failed. The following required production "
                    f"environment variables are missing or empty: {', '.join(missing_vars)}. "
                    "Please configure them in your Render Web Service dashboard."
                )
                logger.critical(error_msg)
                raise RuntimeError(error_msg)

        # Load ML model, preprocessor, and metadata
        ml_loaded = init_model_loader(
            model_path=settings.resolved_ml_model_path,
            preprocessor_path=settings.resolved_ml_preprocessor_path,
            metadata_path=settings.resolved_ml_model_metadata_path,
        )
        logger.info(f"  ML model loaded: {ml_loaded}")
        logger.info("=" * 60)

    # --- Shutdown Event ---
    @application.on_event("shutdown")
    async def shutdown_event():
        logger.info("NeuroScreen API shutting down")

    return application


# Create the app instance
app = create_app()


# -------------------------------------------------------
# Direct execution (for development)
# -------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=settings.is_development,
    )
