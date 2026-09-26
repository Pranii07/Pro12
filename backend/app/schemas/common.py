"""
NeuroScreen — Common Schemas
==============================
Shared response schemas used across multiple endpoints.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Generic, TypeVar, List

from pydantic import BaseModel, Field


# -------------------------------------------------------
# Generic Responses
# -------------------------------------------------------

class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    version: str = "0.1.0"
    environment: str = "development"
    timestamp: datetime


class MessageResponse(BaseModel):
    """Generic message response."""
    message: str
    success: bool = True


# -------------------------------------------------------
# Pagination
# -------------------------------------------------------

T = TypeVar("T")


class PaginationMeta(BaseModel):
    """Pagination metadata."""
    page: int = Field(ge=1, description="Current page number")
    page_size: int = Field(ge=1, le=100, description="Items per page")
    total_items: int = Field(ge=0, description="Total number of items")
    total_pages: int = Field(ge=0, description="Total number of pages")


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated response wrapper."""
    data: List[T]
    pagination: PaginationMeta


class PaginationParams(BaseModel):
    """Pagination query parameters."""
    page: int = Field(default=1, ge=1, description="Page number")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size
