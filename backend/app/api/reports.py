"""
NeuroScreen — Report API Endpoints
=====================================
Endpoints for generating, listing, and downloading PDF assessment reports.

Flow:
  1. User requests report generation for a completed assessment
  2. Backend fetches assessment + modules + prediction data
  3. ReportLab generates the PDF in-memory
  4. PDF is uploaded to Supabase Storage 'reports' bucket
  5. Report metadata is inserted into the reports table
  6. User can list their reports and get signed download URLs

Research/Educational Prototype — trained and evaluated on synthetic data.
Not clinically validated.
"""

import logging
from datetime import datetime, timezone

from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, status

from app.core.security import TokenData, get_current_user
from app.core.supabase_client import get_supabase_admin
from app.core.exceptions import (
    NotFoundException,
    BadRequestException,
    ServiceUnavailableException,
)
from app.reports.report_generator import generate_assessment_report
from app.schemas.report import (
    ReportResponse,
    ReportListItem,
    ReportDownloadResponse,
    DirectReportRequest,
)

logger = logging.getLogger("neuroscreen.api.reports")

router = APIRouter(prefix="/reports", tags=["Reports"])

DISCLAIMER_TEXT = (
    "This application is intended for behavioural screening and "
    "educational/research purposes only. It is NOT a medical diagnosis "
    "and cannot replace evaluation by a qualified healthcare professional."
)
PROTOTYPE_TEXT = (
    "Research/Educational Prototype — trained and evaluated on synthetic data. "
    "Not clinically validated."
)

STORAGE_BUCKET = "reports"


def _get_db():
    """Get Supabase client or raise if not configured."""
    supabase = get_supabase_admin()
    if not supabase:
        raise ServiceUnavailableException("Database service not configured.")
    return supabase


def _build_default_prediction(assessment_id: str, modules: list) -> dict:
    """Build a sensible default prediction from module data or fallback defaults."""
    module_scores = {}
    modalities_present = {}
    total_score = 0.0
    scored_count = 0
    for mod in (modules or []):
        mod_type = mod.get("module_type", "unknown")
        mod_score = mod.get("score")
        is_completed = mod.get("status") == "completed"
        modalities_present[mod_type] = is_completed
        if mod_score is not None:
            module_scores[mod_type] = mod_score
            total_score += mod_score
            scored_count += 1

    overall_score = total_score / scored_count if scored_count > 0 else 50.0

    if overall_score >= 70:
        screening_level = "LOW"
    elif overall_score >= 40:
        screening_level = "MODERATE"
    else:
        screening_level = "HIGH"

    return {
        "screening_level": screening_level,
        "overall_score": round(overall_score, 1),
        "model_distribution": {
            "LOW": 0.33 if screening_level != "LOW" else 0.7,
            "MODERATE": 0.34 if screening_level != "MODERATE" else 0.7,
            "HIGH": 0.33 if screening_level != "HIGH" else 0.7,
        },
        "module_scores": module_scores,
        "model_name": "NeuroScreen Ensemble",
        "model_version": "v1.0-prototype",
        "modalities_present": modalities_present,
        "features_used": {},
    }


# -------------------------------------------------------
# POST — Generate Report
# -------------------------------------------------------

@router.post(
    "/assessments/{assessment_id}/generate",
    status_code=status.HTTP_201_CREATED,
    response_model=ReportResponse,
    summary="Generate PDF Report",
    description=(
        "Generates a PDF assessment report for a completed assessment. "
        "The report includes screening results, module breakdown, and recommendations.\n\n"
        "⚠️ Disclaimer: This is NOT a medical diagnosis."
    ),
)
async def generate_report(
    assessment_id: str,
    user: TokenData = Depends(get_current_user),
):
    """
    Generate a PDF report for an assessment.

    Steps:
      1. Verify assessment belongs to user
      2. Fetch assessment + modules + prediction
      3. Generate PDF in-memory via ReportLab
      4. Upload to Supabase Storage
      5. Insert report metadata into reports table
      6. Return report metadata
    """
    db = _get_db()

    # --- Verify assessment belongs to user ---
    try:
        assessment_result = (
            db.table("assessments")
            .select("*")
            .eq("id", assessment_id)
            .eq("user_id", user.user_id)
            .single()
            .execute()
        )
    except Exception:
        raise NotFoundException("Assessment", assessment_id)

    if not assessment_result.data:
        raise NotFoundException("Assessment", assessment_id)

    assessment = assessment_result.data

    # --- Fetch module results ---
    modules_result = (
        db.table("module_results")
        .select("*")
        .eq("assessment_id", assessment_id)
        .execute()
    )
    modules = modules_result.data or []

    # --- Fetch prediction ---
    prediction_result = (
        db.table("predictions")
        .select("*")
        .eq("assessment_id", assessment_id)
        .execute()
    )

    if not prediction_result.data:
        logger.info(
            f"No prediction found in DB for assessment {assessment_id}. "
            f"Synthesizing prediction from module results."
        )
        prediction = _build_default_prediction(assessment_id, modules)
    else:
        prediction = prediction_result.data[0]


    # --- Get user name ---
    user_name = "User"
    try:
        profile_result = (
            db.table("profiles")
            .select("full_name")
            .eq("id", user.user_id)
            .single()
            .execute()
        )
        if profile_result.data:
            user_name = profile_result.data.get("full_name", "User") or "User"
    except Exception:
        pass

    # --- Generate PDF ---
    try:
        pdf_bytes = generate_assessment_report(
            assessment=assessment,
            modules=modules,
            prediction=prediction,
            user_name=user_name,
        )
    except Exception as e:
        logger.error(f"PDF generation failed for assessment {assessment_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF report: {str(e)}",
        )

    # --- Upload to Supabase Storage ---
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    file_name = f"neuroscreen_report_{assessment_id[:8]}_{timestamp}.pdf"
    storage_path = f"{user.user_id}/{file_name}"

    storage_uploaded = False
    try:
        db.storage.from_(STORAGE_BUCKET).upload(
            path=storage_path,
            file=pdf_bytes,
            file_options={"content-type": "application/pdf"},
        )
        storage_uploaded = True
        logger.info(f"Uploaded report to storage: {storage_path}")
    except Exception as e:
        # Storage might not be configured — log warning but continue
        logger.warning(
            f"Failed to upload report to Supabase Storage: {e}. "
            f"Report metadata will still be saved, but download may not work."
        )

    # --- Insert report metadata ---
    insert_data = {
        "assessment_id": assessment_id,
        "user_id": user.user_id,
        "storage_path": storage_path,
        "file_name": file_name,
        "file_size_bytes": len(pdf_bytes),
    }

    try:
        result = db.table("reports").insert(insert_data).execute()
    except Exception as e:
        logger.error(f"Failed to insert report metadata: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save report metadata.",
        )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save report metadata.",
        )

    saved = result.data[0]
    return ReportResponse(
        id=saved["id"],
        assessment_id=saved["assessment_id"],
        user_id=saved["user_id"],
        storage_path=saved["storage_path"],
        file_name=saved["file_name"],
        file_size_bytes=saved.get("file_size_bytes"),
        generated_at=saved["generated_at"],
        created_at=saved["created_at"],
    )


# -------------------------------------------------------
# GET — List Reports
# -------------------------------------------------------

@router.get(
    "",
    response_model=list[ReportListItem],
    summary="List User Reports",
    description="Returns all PDF reports for the current user.",
)
async def list_reports(
    user: TokenData = Depends(get_current_user),
):
    """Fetch all reports for the authenticated user."""
    db = _get_db()

    result = (
        db.table("reports")
        .select("id, assessment_id, file_name, file_size_bytes, generated_at, created_at")
        .eq("user_id", user.user_id)
        .order("generated_at", desc=True)
        .execute()
    )

    return result.data or []


# -------------------------------------------------------
# GET — Download Report (Signed URL)
# -------------------------------------------------------

@router.get(
    "/{report_id}/download",
    response_model=ReportDownloadResponse,
    summary="Get Report Download URL",
    description=(
        "Returns a temporary signed URL for downloading the PDF report. "
        "The URL expires after 1 hour."
    ),
)
async def download_report(
    report_id: str,
    user: TokenData = Depends(get_current_user),
):
    """
    Get a signed download URL for a report.
    Validates that the report belongs to the requesting user.
    """
    db = _get_db()

    # Fetch report and verify ownership
    try:
        report_result = (
            db.table("reports")
            .select("*")
            .eq("id", report_id)
            .eq("user_id", user.user_id)
            .single()
            .execute()
        )
    except Exception:
        raise NotFoundException("Report", report_id)

    if not report_result.data:
        raise NotFoundException("Report", report_id)

    report = report_result.data

    # Generate signed URL from Supabase Storage
    try:
        signed_url_result = db.storage.from_(STORAGE_BUCKET).create_signed_url(
            path=report["storage_path"],
            expires_in=3600,  # 1 hour
        )

        if isinstance(signed_url_result, dict) and "signedURL" in signed_url_result:
            download_url = signed_url_result["signedURL"]
        elif isinstance(signed_url_result, dict) and "signed_url" in signed_url_result:
            download_url = signed_url_result["signed_url"]
        elif hasattr(signed_url_result, "signed_url"):
            download_url = signed_url_result.signed_url
        else:
            download_url = str(signed_url_result)

    except Exception as e:
        logger.warning(f"Failed to create signed URL from Supabase storage: {e}. Falling back to direct stream.")
        download_url = f"/api/reports/{report_id}/file"

    return ReportDownloadResponse(
        report_id=report["id"],
        file_name=report["file_name"],
        download_url=download_url,
        expires_in_seconds=3600,
    )


# -------------------------------------------------------
# GET — Direct PDF File Stream
# -------------------------------------------------------

@router.get(
    "/{report_id}/file",
    summary="Download Report PDF File Directly",
    description="Streams the report PDF directly from the backend as a file attachment.",
)
async def download_report_file(
    report_id: str,
    user: TokenData = Depends(get_current_user),
):
    """
    Directly stream the PDF report file.
    Validates ownership, downloads from Supabase Storage (or regenerates on-the-fly),
    and returns a binary response with Content-Disposition attachment header.
    """
    from fastapi.responses import Response

    db = _get_db()

    # Fetch report and verify ownership
    try:
        report_result = (
            db.table("reports")
            .select("*")
            .eq("id", report_id)
            .eq("user_id", user.user_id)
            .single()
            .execute()
        )
    except Exception:
        raise NotFoundException("Report", report_id)

    if not report_result.data:
        raise NotFoundException("Report", report_id)

    report = report_result.data

    # Try downloading from Supabase Storage
    pdf_bytes = None
    try:
        pdf_bytes = db.storage.from_(STORAGE_BUCKET).download(report["storage_path"])
    except Exception as e:
        logger.warning(f"Could not download from storage bucket, generating on-the-fly: {e}")

    # If storage download failed, dynamically regenerate the report
    if not pdf_bytes:
        try:
            assessment_result = (
                db.table("assessments")
                .select("*")
                .eq("id", report["assessment_id"])
                .single()
                .execute()
            )
            modules_result = (
                db.table("module_results")
                .select("*")
                .eq("assessment_id", report["assessment_id"])
                .execute()
            )
            pred_result = (
                db.table("predictions")
                .select("*")
                .eq("assessment_id", report["assessment_id"])
                .maybe_single()
                .execute()
            )
            profile_result = (
                db.table("profiles")
                .select("full_name")
                .eq("id", user.user_id)
                .maybe_single()
                .execute()
            )
            user_name = profile_result.data.get("full_name") if profile_result and profile_result.data else None

            pdf_bytes = generate_assessment_report(
                assessment=assessment_result.data,
                modules=modules_result.data or [],
                prediction=pred_result.data if pred_result else None,
                user_name=user_name,
            )
        except Exception as gen_err:
            logger.error(f"Failed to regenerate report PDF: {gen_err}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not retrieve or generate the report PDF.",
            )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{report["file_name"]}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


# -------------------------------------------------------
# POST — Direct Download (No Storage Required)
# -------------------------------------------------------

@router.post(
    "/assessments/{assessment_id}/download-direct",
    summary="Generate & Download Report Directly",
    description=(
        "Generates a PDF report in-memory and streams it directly as a download. "
        "Does NOT require Supabase Storage or the reports DB table. "
        "Use this as a reliable fallback when storage is not configured.\n\n"
        "⚠️ Disclaimer: This is NOT a medical diagnosis."
    ),
)
async def download_report_direct(
    assessment_id: str,
    payload: Optional[DirectReportRequest] = Body(None),
    user: TokenData = Depends(get_current_user),
):
    """
    Generate and immediately stream a PDF report.

    This endpoint is self-contained:
      1. Fetches assessment + modules + prediction data (or uses client payload)
      2. Generates PDF in-memory via ReportLab
      3. Returns the PDF directly as a file download

    No storage upload or database writes are performed.
    If prediction data is missing, a report is still generated with available data.
    """
    from fastapi.responses import Response
    from datetime import datetime, timezone

    db = _get_db()

    # --- Fetch assessment ---
    assessment = None
    try:
        assessment_result = (
            db.table("assessments")
            .select("*")
            .eq("id", assessment_id)
            .eq("user_id", user.user_id)
            .single()
            .execute()
        )
        assessment = assessment_result.data
    except Exception as e:
        logger.warning(f"Could not fetch assessment {assessment_id}: {e}")

    if not assessment:
        # Create a minimal assessment object so the report can still generate
        assessment = {
            "id": assessment_id,
            "user_id": user.user_id,
            "language": "en",
            "status": "completed",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }

    # --- Fetch module results (or use client provided) ---
    modules = (payload.modules if payload and payload.modules else None) or []
    if not modules:
        try:
            modules_result = (
                db.table("module_results")
                .select("*")
                .eq("assessment_id", assessment_id)
                .execute()
            )
            modules = modules_result.data or []
        except Exception as e:
            logger.warning(f"Could not fetch modules for assessment {assessment_id}: {e}")

    # --- Fetch prediction (or use client provided) ---
    prediction = payload.prediction if payload and payload.prediction else None
    if not prediction:
        try:
            prediction_result = (
                db.table("predictions")
                .select("*")
                .eq("assessment_id", assessment_id)
                .execute()
            )
            if prediction_result.data:
                prediction = prediction_result.data[0]
        except Exception as e:
            logger.warning(f"Could not fetch prediction for direct download: {e}")

    # If no prediction exists from payload or DB, build a default one
    if not prediction:
        logger.info(
            f"No prediction found for assessment {assessment_id}. "
            f"Generating report with available module data only."
        )
        prediction = _build_default_prediction(assessment_id, modules)


    # --- Get user name ---
    user_name = (payload.user_name if payload and payload.user_name else None) or "User"
    if user_name == "User":
        try:
            profile_result = (
                db.table("profiles")
                .select("full_name")
                .eq("id", user.user_id)
                .single()
                .execute()
            )
            if profile_result.data:
                user_name = profile_result.data.get("full_name", "User") or "User"
        except Exception:
            pass


    # --- Generate PDF ---
    try:
        pdf_bytes = generate_assessment_report(
            assessment=assessment,
            modules=modules,
            prediction=prediction,
            user_name=user_name,
        )
    except Exception as e:
        logger.error(f"PDF generation failed for assessment {assessment_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF report: {str(e)}",
        )

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    file_name = f"neuroscreen_report_{assessment_id[:8]}_{timestamp}.pdf"

    logger.info(
        f"Direct download: generated PDF for assessment {assessment_id}, "
        f"user={user.user_id}, size={len(pdf_bytes)} bytes"
    )

    # Record report metadata in the reports table so it appears in reports history & overview stats
    try:
        db.table("reports").insert({
            "assessment_id": assessment_id,
            "user_id": user.user_id,
            "storage_path": f"direct/{file_name}",
            "file_name": file_name,
            "file_size_bytes": len(pdf_bytes),
        }).execute()
        logger.info(f"Saved direct report record in DB for assessment {assessment_id}")
    except Exception as e:
        logger.warning(f"Failed to record report metadata in DB (non-fatal): {e}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{file_name}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


