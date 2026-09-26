"""
NeuroScreen — Custom Exceptions & Global Error Handlers
========================================================
Defines application-specific exceptions and FastAPI exception handlers
for consistent error responses across all endpoints.
"""

from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel


# -------------------------------------------------------
# Error Response Schema
# -------------------------------------------------------

class ErrorResponse(BaseModel):
    """Standardized error response body."""
    detail: str
    error_code: str | None = None
    status_code: int


# -------------------------------------------------------
# Custom Exceptions
# -------------------------------------------------------

class NeuroScreenException(Exception):
    """Base exception for all NeuroScreen application errors."""

    def __init__(
        self,
        detail: str = "An unexpected error occurred.",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code: str | None = None,
    ):
        self.detail = detail
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(detail)


class NotFoundException(NeuroScreenException):
    """Resource not found."""

    def __init__(self, resource: str = "Resource", resource_id: str = ""):
        detail = f"{resource} not found"
        if resource_id:
            detail = f"{resource} '{resource_id}' not found"
        super().__init__(
            detail=detail,
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
        )


class ForbiddenException(NeuroScreenException):
    """User lacks permission for this action."""

    def __init__(self, detail: str = "You do not have permission to perform this action."):
        super().__init__(
            detail=detail,
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="FORBIDDEN",
        )


class BadRequestException(NeuroScreenException):
    """Invalid request data."""

    def __init__(self, detail: str = "Invalid request."):
        super().__init__(
            detail=detail,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="BAD_REQUEST",
        )


class ConflictException(NeuroScreenException):
    """Resource conflict (e.g., duplicate entry)."""

    def __init__(self, detail: str = "Resource conflict."):
        super().__init__(
            detail=detail,
            status_code=status.HTTP_409_CONFLICT,
            error_code="CONFLICT",
        )


class ServiceUnavailableException(NeuroScreenException):
    """External service unavailable (e.g., Supabase not configured)."""

    def __init__(self, detail: str = "Service temporarily unavailable."):
        super().__init__(
            detail=detail,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="SERVICE_UNAVAILABLE",
        )


# -------------------------------------------------------
# Exception Handlers (register with FastAPI app)
# -------------------------------------------------------

def register_exception_handlers(app: FastAPI) -> None:
    """Register all custom exception handlers on the FastAPI app."""

    @app.exception_handler(NeuroScreenException)
    async def neuroscreen_exception_handler(
        request: Request, exc: NeuroScreenException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(
                detail=exc.detail,
                error_code=exc.error_code,
                status_code=exc.status_code,
            ).model_dump(),
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """Catch-all for unhandled exceptions. Never leak stack traces in production."""
        import logging
        logging.exception(f"Unhandled exception on {request.method} {request.url}: {exc}")

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(
                detail="An internal server error occurred.",
                error_code="INTERNAL_ERROR",
                status_code=500,
            ).model_dump(),
        )
