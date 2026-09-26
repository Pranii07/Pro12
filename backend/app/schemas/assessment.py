"""
NeuroScreen — Assessment Schemas
==================================
Pydantic schemas for assessment sessions and module results.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum

from pydantic import BaseModel, Field


# -------------------------------------------------------
# Enums
# -------------------------------------------------------

class AssessmentStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class ModuleType(str, Enum):
    TYPING = "typing"
    MEMORY = "memory"
    REACTION = "reaction"
    SPEECH = "speech"
    FACIAL = "facial"


class ModuleStatus(str, Enum):
    COMPLETED = "completed"
    SKIPPED = "skipped"
    PENDING = "pending"


# -------------------------------------------------------
# Assessment Schemas
# -------------------------------------------------------

class AssessmentCreate(BaseModel):
    """Create a new assessment session."""
    language: str = Field(default="en", pattern="^(en|kn)$", description="Assessment language: 'en' or 'kn'")


class AssessmentUpdate(BaseModel):
    """Update an assessment's status."""
    status: AssessmentStatus


class AssessmentResponse(BaseModel):
    """Assessment session response."""
    id: str
    user_id: str
    language: str
    status: AssessmentStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class AssessmentWithModules(AssessmentResponse):
    """Assessment with its module results."""
    module_results: List["ModuleResultResponse"] = []


# -------------------------------------------------------
# Module Result Schemas
# -------------------------------------------------------

class ModuleResultCreate(BaseModel):
    """Submit results for a single assessment module."""
    module_type: ModuleType
    status: ModuleStatus = ModuleStatus.COMPLETED
    features: Dict[str, Any] = Field(default_factory=dict, description="Module-specific feature vector as JSON")
    score: Optional[float] = Field(None, ge=0, le=100, description="Normalized module score (0-100)")
    duration_seconds: Optional[float] = Field(None, ge=0, description="Time spent on this module")


class ModuleResultResponse(BaseModel):
    """Module result as returned from the API."""
    id: str
    assessment_id: str
    module_type: ModuleType
    status: ModuleStatus
    features: Dict[str, Any] = {}
    score: Optional[float] = None
    duration_seconds: Optional[float] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# -------------------------------------------------------
# Assessment List (for dashboard / history)
# -------------------------------------------------------

class AssessmentSummary(BaseModel):
    """Lightweight assessment info for list views."""
    id: str
    language: str
    status: AssessmentStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    modules_completed: int = 0
    modules_total: int = 5
    screening_level: Optional[str] = None  # LOW / MODERATE / HIGH if prediction exists


# Forward reference resolution
AssessmentWithModules.model_rebuild()
