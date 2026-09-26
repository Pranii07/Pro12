"""
NeuroScreen — PDF Report Generator
======================================
Server-side PDF report generation using ReportLab.

Generates a styled assessment report containing:
  - NeuroScreen branding header
  - Mandatory disclaimer + prototype notice
  - Assessment metadata (date, language, model, version)
  - Overall Behavioural Screening Level with score
  - Per-module breakdown table
  - Model Screening Distribution (bar chart)
  - Recommendations based on screening level
  - Footer with timestamp

The PDF is generated entirely in-memory (BytesIO) — no files are
written to disk, following the Section 6 media pipeline pattern.

Research/Educational Prototype — trained and evaluated on synthetic data.
Not clinically validated.
"""

from __future__ import annotations

import io
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics import renderPDF

logger = logging.getLogger("neuroscreen.reports")

# -------------------------------------------------------
# Constants
# -------------------------------------------------------

DISCLAIMER_TEXT = (
    "This application is intended for behavioural screening and "
    "educational/research purposes only. It is NOT a medical diagnosis "
    "and cannot replace evaluation by a qualified healthcare professional."
)

PROTOTYPE_TEXT = (
    "Research/Educational Prototype — trained and evaluated on "
    "synthetic data. Not clinically validated."
)

# Color palette (matching NeuroScreen design system)
PRIMARY_COLOR = colors.HexColor("#7C3AED")     # Violet
SECONDARY_COLOR = colors.HexColor("#06B6D4")   # Cyan
ACCENT_COLOR = colors.HexColor("#F59E0B")       # Amber
SUCCESS_COLOR = colors.HexColor("#22C55E")      # Green
WARNING_COLOR = colors.HexColor("#EAB308")      # Yellow
DANGER_COLOR = colors.HexColor("#EF4444")       # Red
DARK_BG = colors.HexColor("#1E1B2E")            # Dark background
MUTED_TEXT = colors.HexColor("#6B7280")          # Gray-500
LIGHT_BG = colors.HexColor("#F8FAFC")           # Light bg

# Screening level colors
LEVEL_COLORS = {
    "LOW": colors.HexColor("#22C55E"),
    "MODERATE": colors.HexColor("#F59E0B"),
    "HIGH": colors.HexColor("#EF4444"),
}

LEVEL_LABELS = {
    "LOW": "Low Risk Indicators",
    "MODERATE": "Moderate Risk Indicators",
    "HIGH": "Elevated Risk Indicators",
}

# Module display names
MODULE_NAMES = {
    "typing": "Typing Analysis",
    "memory": "Memory Tests",
    "reaction": "Reaction Time",
    "speech": "Speech Analysis",
    "facial": "Facial Analysis",
}

# Recommendations per screening level
RECOMMENDATIONS = {
    "LOW": [
        "Your behavioural screening indicators are within normal ranges.",
        "Continue regular self-monitoring and maintain healthy habits.",
        "Periodic reassessment is recommended for ongoing tracking.",
        "No immediate follow-up action is suggested by this screening.",
    ],
    "MODERATE": [
        "Some behavioural indicators show moderate deviation from expected ranges.",
        "Consider discussing these results with a healthcare professional.",
        "Regular reassessments can help track patterns over time.",
        "Lifestyle factors (sleep, stress, exercise) may influence these results.",
        "This screening result does NOT indicate a diagnosis of any condition.",
    ],
    "HIGH": [
        "Several behavioural indicators show significant deviation from expected ranges.",
        "It is recommended to consult with a qualified healthcare professional.",
        "This result is NOT a diagnosis — it suggests further professional evaluation may be beneficial.",
        "Factors such as fatigue, stress, or distraction may affect screening performance.",
        "Consider retaking the assessment under optimal conditions for comparison.",
    ],
}


# -------------------------------------------------------
# Custom Styles
# -------------------------------------------------------

def _create_styles() -> dict:
    """Create custom ReportLab paragraph styles for the report."""
    base = getSampleStyleSheet()

    styles = {
        "title": ParagraphStyle(
            "ReportTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=28,
            textColor=PRIMARY_COLOR,
            spaceAfter=6,
        ),
        "subtitle": ParagraphStyle(
            "ReportSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=14,
            textColor=MUTED_TEXT,
            spaceAfter=12,
        ),
        "section_heading": ParagraphStyle(
            "SectionHeading",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=PRIMARY_COLOR,
            spaceBefore=16,
            spaceAfter=8,
        ),
        "body": ParagraphStyle(
            "BodyText",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#374151"),
        ),
        "body_bold": ParagraphStyle(
            "BodyBold",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#1F2937"),
        ),
        "disclaimer": ParagraphStyle(
            "Disclaimer",
            parent=base["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=8,
            leading=11,
            textColor=MUTED_TEXT,
            spaceBefore=4,
            spaceAfter=4,
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7,
            leading=10,
            textColor=MUTED_TEXT,
            alignment=TA_CENTER,
        ),
        "score_large": ParagraphStyle(
            "ScoreLarge",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=36,
            leading=42,
            alignment=TA_CENTER,
            spaceAfter=4,
        ),
        "level_label": ParagraphStyle(
            "LevelLabel",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            alignment=TA_CENTER,
            spaceAfter=8,
        ),
        "meta_label": ParagraphStyle(
            "MetaLabel",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=MUTED_TEXT,
        ),
        "meta_value": ParagraphStyle(
            "MetaValue",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#1F2937"),
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#374151"),
            leftIndent=20,
            bulletIndent=10,
        ),
    }
    return styles


# -------------------------------------------------------
# Drawing Helpers
# -------------------------------------------------------

def _create_distribution_chart(
    distribution: Dict[str, float],
    width: float = 400,
    height: float = 100,
) -> Drawing:
    """Create a horizontal bar chart for the model screening distribution."""
    d = Drawing(width, height)
    bar_height = 24
    label_width = 80
    bar_max_width = width - label_width - 60
    y_start = height - 20

    for i, level in enumerate(["LOW", "MODERATE", "HIGH"]):
        value = distribution.get(level, 0.0)
        y = y_start - (i * (bar_height + 10))

        # Label
        d.add(String(0, y + 6, level, fontName="Helvetica-Bold", fontSize=9,
                      fillColor=LEVEL_COLORS.get(level, MUTED_TEXT)))

        # Background bar
        d.add(Rect(label_width, y, bar_max_width, bar_height,
                    fillColor=colors.HexColor("#F3F4F6"),
                    strokeColor=None, rx=4, ry=4))

        # Value bar
        if value > 0:
            bar_w = max(bar_max_width * value, 8)
            d.add(Rect(label_width, y, bar_w, bar_height,
                        fillColor=LEVEL_COLORS.get(level, MUTED_TEXT),
                        strokeColor=None, rx=4, ry=4))

        # Percentage label
        pct_text = f"{value * 100:.1f}%"
        d.add(String(label_width + bar_max_width + 8, y + 6, pct_text,
                      fontName="Helvetica", fontSize=9, fillColor=MUTED_TEXT))

    return d


# -------------------------------------------------------
# Report Builder
# -------------------------------------------------------

def generate_assessment_report(
    assessment: Dict[str, Any],
    modules: List[Dict[str, Any]],
    prediction: Dict[str, Any],
    user_name: str = "User",
) -> bytes:
    """
    Generate a PDF assessment report in-memory.

    Args:
        assessment: Assessment data (id, language, status, started_at, completed_at)
        modules: List of module result dicts (module_type, status, score, features)
        prediction: Prediction data (screening_level, overall_score, model_distribution,
                    module_scores, model_name, model_version, modalities_present)
        user_name: User's display name for the report header

    Returns:
        PDF content as bytes (ready to upload or stream)
    """
    buffer = io.BytesIO()
    styles = _create_styles()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=50,
        leftMargin=50,
        topMargin=40,
        bottomMargin=40,
        title="NeuroScreen Assessment Report",
        author="NeuroScreen",
        subject="Behavioural Screening Assessment Report",
    )

    elements: list = []
    page_width = A4[0] - 100  # width minus margins

    # =======================================================
    # Header
    # =======================================================
    elements.append(Paragraph("NeuroScreen", styles["title"]))
    elements.append(Paragraph(
        "Behavioural AI Framework for Early Neurological Risk Detection",
        styles["subtitle"],
    ))
    elements.append(HRFlowable(
        width="100%", thickness=1.5, color=PRIMARY_COLOR,
        spaceAfter=12, spaceBefore=4,
    ))

    # =======================================================
    # Disclaimers
    # =======================================================
    disclaimer_data = [[Paragraph(
        f"<b>⚠ Disclaimer:</b> {DISCLAIMER_TEXT}",
        styles["disclaimer"],
    )]]
    disclaimer_table = Table(disclaimer_data, colWidths=[page_width])
    disclaimer_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
        ("BOX", (0, 0), (-1, -1), 0.5, WARNING_COLOR),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    elements.append(disclaimer_table)
    elements.append(Spacer(1, 6))

    prototype_data = [[Paragraph(
        f"<b>ℹ Research/Educational Prototype:</b> {PROTOTYPE_TEXT}",
        styles["disclaimer"],
    )]]
    prototype_table = Table(prototype_data, colWidths=[page_width])
    prototype_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EDE9FE")),
        ("BOX", (0, 0), (-1, -1), 0.5, PRIMARY_COLOR),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    elements.append(prototype_table)
    elements.append(Spacer(1, 16))

    # =======================================================
    # Assessment Metadata
    # =======================================================
    elements.append(Paragraph("Assessment Details", styles["section_heading"]))

    assessment_date = assessment.get("started_at", "N/A")
    if isinstance(assessment_date, str) and len(assessment_date) > 10:
        try:
            dt = datetime.fromisoformat(assessment_date.replace("Z", "+00:00"))
            assessment_date = dt.strftime("%B %d, %Y at %I:%M %p")
        except (ValueError, TypeError):
            pass

    completed_date = assessment.get("completed_at")
    if isinstance(completed_date, str) and len(completed_date) > 10:
        try:
            dt = datetime.fromisoformat(completed_date.replace("Z", "+00:00"))
            completed_date = dt.strftime("%B %d, %Y at %I:%M %p")
        except (ValueError, TypeError):
            pass

    meta_pairs = [
        ("Participant", user_name),
        ("Assessment Date", assessment_date),
        ("Completed", completed_date or "In Progress"),
        ("Language", "English" if assessment.get("language") == "en" else "Kannada"),
        ("Model", f"{prediction.get('model_name', 'N/A')} v{prediction.get('model_version', 'N/A')}"),
        ("Assessment ID", assessment.get("id", "N/A")[:8] + "..."),
    ]

    meta_table_data = []
    row = []
    for i, (label, value) in enumerate(meta_pairs):
        row.append(Paragraph(f"<b>{label}</b>", styles["meta_label"]))
        row.append(Paragraph(str(value), styles["meta_value"]))
        if (i + 1) % 3 == 0:
            meta_table_data.append(row)
            row = []
    if row:
        while len(row) < 6:
            row.append(Paragraph("", styles["meta_label"]))
        meta_table_data.append(row)

    col_w = page_width / 6
    meta_table = Table(meta_table_data, colWidths=[col_w * 0.8, col_w * 1.2] * 3)
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F9FAFB")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E5E7EB")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 16))

    # =======================================================
    # Overall Screening Result
    # =======================================================
    elements.append(Paragraph("Behavioural Screening Result", styles["section_heading"]))

    screening_level = prediction.get("screening_level", "N/A")
    overall_score = prediction.get("overall_score")
    level_color = LEVEL_COLORS.get(screening_level, MUTED_TEXT)
    level_label = LEVEL_LABELS.get(screening_level, screening_level)

    score_style = ParagraphStyle(
        "ScoreDynamic", parent=styles["score_large"],
        textColor=level_color,
    )
    level_style = ParagraphStyle(
        "LevelDynamic", parent=styles["level_label"],
        textColor=level_color,
    )

    score_text = f"{overall_score:.1f}" if overall_score is not None else "—"
    score_block = [
        [Paragraph(score_text, score_style)],
        [Paragraph(f"Overall Behaviour Score", styles["disclaimer"])],
        [Spacer(1, 4)],
        [Paragraph(f"Behavioural Screening Level: {screening_level}", level_style)],
        [Paragraph(level_label, styles["body"])],
    ]

    score_table = Table(score_block, colWidths=[page_width])
    score_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAFAFA")),
        ("BOX", (0, 0), (-1, -1), 1, level_color),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    elements.append(score_table)
    elements.append(Spacer(1, 16))

    # =======================================================
    # Model Screening Distribution
    # =======================================================
    distribution = prediction.get("model_distribution", {})
    if distribution:
        elements.append(Paragraph("Model Screening Distribution", styles["section_heading"]))
        elements.append(Paragraph(
            "Distribution of the model's screening assessment across levels. "
            "This is NOT a probability — it reflects the model's screening assessment pattern.",
            styles["disclaimer"],
        ))
        elements.append(Spacer(1, 6))
        chart = _create_distribution_chart(distribution, width=page_width, height=110)
        elements.append(chart)
        elements.append(Spacer(1, 16))

    # =======================================================
    # Module Breakdown
    # =======================================================
    elements.append(Paragraph("Module Breakdown", styles["section_heading"]))

    module_scores = prediction.get("module_scores", {})
    modalities_present = prediction.get("modalities_present", {})

    # Build table data
    mod_header = [
        Paragraph("<b>Module</b>", styles["meta_label"]),
        Paragraph("<b>Status</b>", styles["meta_label"]),
        Paragraph("<b>Score</b>", styles["meta_label"]),
        Paragraph("<b>Key Features</b>", styles["meta_label"]),
    ]
    mod_rows = [mod_header]

    for mod_type in ["typing", "memory", "reaction", "speech", "facial"]:
        name = MODULE_NAMES.get(mod_type, mod_type.capitalize())
        present = modalities_present.get(mod_type, False)
        score = module_scores.get(mod_type)

        # Find the module data for key features
        mod_data = next((m for m in modules if m.get("module_type") == mod_type), None)
        features = mod_data.get("features", {}) if mod_data else {}

        # Format key features (top 3)
        feature_strs = []
        for k, v in list(features.items())[:3]:
            display_key = k.replace("_", " ").title()
            if isinstance(v, float):
                feature_strs.append(f"{display_key}: {v:.2f}")
            else:
                feature_strs.append(f"{display_key}: {v}")
        features_text = ", ".join(feature_strs) if feature_strs else "—"

        status_text = "Completed" if present else "Skipped"
        score_text = f"{score:.1f}/100" if score is not None else "—"

        mod_rows.append([
            Paragraph(name, styles["body_bold"]),
            Paragraph(status_text, styles["body"]),
            Paragraph(score_text, styles["body"]),
            Paragraph(features_text, styles["body"]),
        ])

    mod_table = Table(mod_rows, colWidths=[
        page_width * 0.2, page_width * 0.15, page_width * 0.15, page_width * 0.5
    ])

    # Alternate row colors
    mod_style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E5E7EB")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]
    for i in range(1, len(mod_rows)):
        if i % 2 == 0:
            mod_style_cmds.append(
                ("BACKGROUND", (0, i), (-1, i), colors.HexColor("#F9FAFB"))
            )

    mod_table.setStyle(TableStyle(mod_style_cmds))
    elements.append(mod_table)
    elements.append(Spacer(1, 16))

    # =======================================================
    # Recommendations
    # =======================================================
    elements.append(Paragraph("Recommendations", styles["section_heading"]))

    recs = RECOMMENDATIONS.get(screening_level, RECOMMENDATIONS["LOW"])
    for rec in recs:
        elements.append(Paragraph(f"• {rec}", styles["bullet"]))
        elements.append(Spacer(1, 3))

    elements.append(Spacer(1, 12))

    # =======================================================
    # Completed Modules Summary
    # =======================================================
    completed_count = sum(1 for v in modalities_present.values() if v)
    total_count = len(modalities_present) if modalities_present else 5

    elements.append(Paragraph(
        f"Assessment completed with {completed_count} of {total_count} modules. "
        f"{'Skipped modules may affect the accuracy of the screening result. ' if completed_count < total_count else ''}"
        f"Module scores are normalized to a 0-100 scale for comparison purposes.",
        styles["body"],
    ))
    elements.append(Spacer(1, 20))

    # =======================================================
    # Footer
    # =======================================================
    elements.append(HRFlowable(
        width="100%", thickness=0.5, color=MUTED_TEXT,
        spaceAfter=8, spaceBefore=4,
    ))

    now = datetime.now(timezone.utc).strftime("%B %d, %Y at %I:%M %p UTC")
    elements.append(Paragraph(
        f"Report generated on {now} by NeuroScreen",
        styles["footer"],
    ))
    elements.append(Paragraph(
        f"Assessment ID: {assessment.get('id', 'N/A')}",
        styles["footer"],
    ))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(DISCLAIMER_TEXT, styles["disclaimer"]))
    elements.append(Paragraph(PROTOTYPE_TEXT, styles["disclaimer"]))

    # =======================================================
    # Build PDF
    # =======================================================
    try:
        doc.build(elements)
    except Exception as e:
        logger.error(f"Failed to build PDF report: {e}")
        raise RuntimeError(f"PDF generation failed: {e}") from e

    pdf_bytes = buffer.getvalue()
    buffer.close()

    logger.info(
        f"Generated PDF report for assessment {assessment.get('id', '?')}: "
        f"{len(pdf_bytes)} bytes"
    )

    return pdf_bytes
