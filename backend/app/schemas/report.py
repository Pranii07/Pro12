"""
NeuroScreen — Report Schemas
================================
Pydantic schemas for PDF report generation and management.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ReportResponse(BaseModel):
    """Response after generating or retrieving a report."""
    id: str
    assessment_id: str
    user_id: str
    storage_path: str
    file_name: str
    file_size_bytes: Optional[int] = None
    generated_at: datetime
    created_at: datetime
    disclaimer: str = Field(
        default=(
            "This application is intended for behavioural screening and "
            "educational/research purposes only. It is NOT a medical diagnosis "
            "and cannot replace evaluation by a qualified healthcare professional."
        )
    )
    prototype_notice: str = Field(
        default=(
            "Research/Educational Prototype — trained and evaluated on "
            "synthetic data. Not clinically validated."
        )
    )


class ReportListItem(BaseModel):
    """Lightweight report info for list views."""
    id: str
    assessment_id: str
    file_name: str
    file_size_bytes: Optional[int] = None
    generated_at: datetime
    created_at: datetime


class ReportDownloadResponse(BaseModel):
    """Response containing a temporary signed URL for downloading a report PDF."""
    report_id: str
    file_name: str
    download_url: str
    expires_in_seconds: int = 3600
    disclaimer: str = Field(
        default=(
            "This application is intended for behavioural screening and "
            "educational/research purposes only. It is NOT a medical diagnosis "
            "and cannot replace evaluation by a qualified healthcare professional."
        )
    )


class DirectReportRequest(BaseModel):
    """Optional payload for direct report download with client-side state."""
    prediction: Optional[dict] = None
    modules: Optional[list[dict]] = None
    user_name: Optional[str] = None

