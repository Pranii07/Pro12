"""
NeuroScreen — Cognitive Benchmark Schemas
==========================================
Pydantic schemas for Cognitive Lab benchmark recording and admin surveillance.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class BenchmarkCreate(BaseModel):
    """Payload to record a completed benchmark test."""
    test_type: str = Field(..., description="One of: reaction, verbal, number, visual, chimp, aim")
    score: float = Field(..., description="Primary test score value")
    unit: str = Field("", description="Unit of measurement (ms, words, digits, level, etc.)")
    details: Dict[str, Any] = Field(default_factory=dict, description="Detailed trial breakdowns, errors, etc.")


class BenchmarkResponse(BaseModel):
    """Single benchmark record."""
    id: str
    user_id: str
    test_type: str
    score: float
    unit: str
    details: Dict[str, Any] = Field(default_factory=dict)
    is_best: bool = False
    created_at: datetime


class UserBenchmarkBest(BaseModel):
    """Personal best record for a single test type."""
    test_type: str
    best_score: float
    unit: str
    attempts_count: int = 1
    last_tested_at: datetime


class CognitiveDomainInsight(BaseModel):
    """Clinical neurological insight for a specific cognitive domain."""
    domain_key: str
    domain_name: str
    brain_region: str
    test_type: str
    raw_score: Optional[float] = None
    unit: str = ""
    normalized_score: float = 50.0
    z_score: float = 0.0
    clinical_status: str = "NORMAL"
    clinical_indicator: str = ""
    associated_condition: str = ""


class ClinicalBenchmarkSummary(BaseModel):
    """Holistic clinical neurological summary for clinicians and admins."""
    overall_stability: str = "STABLE"
    composite_cognitive_index: float = 50.0
    domains: List[CognitiveDomainInsight] = Field(default_factory=list)
    clinical_findings: List[str] = Field(default_factory=list)
    longitudinal_trend: str = "STABLE"
    primary_neurological_profile: str = "Normal Baseline"


class UserBenchmarkProfile(BaseModel):
    """User profile with their benchmark personal bests and history."""
    user_id: str
    full_name: str
    email: Optional[str] = None
    role: str = "USER"
    bests: Dict[str, UserBenchmarkBest] = Field(default_factory=dict)
    recent_attempts: List[BenchmarkResponse] = Field(default_factory=list)
    total_tests_taken: int = 0
    last_active: Optional[datetime] = None
    clinical_summary: Optional[ClinicalBenchmarkSummary] = None


class AdminBenchmarkOverview(BaseModel):
    """Platform-wide benchmark statistics for administrators."""
    total_attempts: int = 0
    active_users_count: int = 0
    avg_reaction_time_ms: Optional[float] = None
    avg_verbal_score: Optional[float] = None
    avg_number_span: Optional[float] = None
    avg_aim_time_ms: Optional[float] = None
    most_popular_test: Optional[str] = None
    recent_activity: List[BenchmarkResponse] = Field(default_factory=list)
