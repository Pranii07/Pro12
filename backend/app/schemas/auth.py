"""
NeuroScreen — Auth Schemas
============================
Pydantic schemas for authentication-related endpoints.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from enum import Enum

from pydantic import BaseModel, Field, EmailStr


# -------------------------------------------------------
# Enums
# -------------------------------------------------------

class UserRole(str, Enum):
    USER = "USER"
    ADMIN = "ADMIN"


class LanguageCode(str, Enum):
    EN = "en"
    KN = "kn"


# -------------------------------------------------------
# User / Profile Schemas
# -------------------------------------------------------

class ProfileResponse(BaseModel):
    """User profile as returned from the API."""
    id: str
    email: Optional[str] = None
    full_name: str
    role: UserRole
    language_preference: LanguageCode
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ProfileUpdate(BaseModel):
    """Fields that a user can update on their own profile."""
    full_name: Optional[str] = Field(None, min_length=1, max_length=200)
    language_preference: Optional[LanguageCode] = None
    avatar_url: Optional[str] = None


class UserWithStats(ProfileResponse):
    """Profile with assessment statistics (for admin views)."""
    total_assessments: int = 0
    completed_assessments: int = 0
    cognitive_tests: int = 0
    last_assessment_at: Optional[datetime] = None


class UserAdminUpdate(BaseModel):
    """Fields an admin can update on any user profile."""
    full_name: Optional[str] = Field(None, min_length=1, max_length=200)
    role: Optional[UserRole] = None
    language_preference: Optional[LanguageCode] = None

