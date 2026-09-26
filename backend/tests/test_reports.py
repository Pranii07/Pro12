"""
NeuroScreen — PDF Report Generation Tests
=============================================
Tests for the ReportLab PDF generator.

These are unit tests that don't require Supabase or any external service.
They verify that the PDF generator produces valid output with expected content.
"""

import pytest
from app.reports.report_generator import generate_assessment_report


# -------------------------------------------------------
# Test Data Fixtures
# -------------------------------------------------------

SAMPLE_ASSESSMENT = {
    "id": "test-assessment-001",
    "language": "en",
    "status": "completed",
    "started_at": "2026-09-16T10:00:00Z",
    "completed_at": "2026-09-16T10:30:00Z",
}

SAMPLE_MODULES = [
    {
        "module_type": "typing",
        "status": "completed",
        "score": 72,
        "features": {"wpm": 45.2, "cpm": 225.5, "accuracy": 0.88},
    },
    {
        "module_type": "memory",
        "status": "completed",
        "score": 65,
        "features": {"word_recall_accuracy": 0.75, "number_recall_accuracy": 0.80},
    },
    {
        "module_type": "reaction",
        "status": "completed",
        "score": 58,
        "features": {"avg_reaction_time_ms": 410, "fastest_reaction_ms": 280},
    },
    {
        "module_type": "speech",
        "status": "skipped",
        "score": None,
        "features": {},
    },
    {
        "module_type": "facial",
        "status": "completed",
        "score": 68,
        "features": {"blink_rate_per_min": 14.2, "attention_score": 0.72},
    },
]

SAMPLE_PREDICTION = {
    "screening_level": "MODERATE",
    "overall_score": 58.4,
    "model_distribution": {"LOW": 0.32, "MODERATE": 0.52, "HIGH": 0.16},
    "module_scores": {
        "typing": 72,
        "memory": 65,
        "reaction": 58,
        "speech": None,
        "facial": 68,
    },
    "modalities_present": {
        "typing": True,
        "memory": True,
        "reaction": True,
        "speech": False,
        "facial": True,
    },
    "model_name": "SVM",
    "model_version": "1.0.0",
}


# -------------------------------------------------------
# Tests
# -------------------------------------------------------

class TestPDFGeneration:
    """Tests for the PDF report generator."""

    def test_generates_valid_pdf(self):
        """PDF output should start with %PDF- header."""
        result = generate_assessment_report(
            assessment=SAMPLE_ASSESSMENT,
            modules=SAMPLE_MODULES,
            prediction=SAMPLE_PREDICTION,
            user_name="Test User",
        )

        assert isinstance(result, bytes)
        assert result[:5] == b"%PDF-"

    def test_pdf_has_reasonable_size(self):
        """Generated PDF should be between 1KB and 500KB."""
        result = generate_assessment_report(
            assessment=SAMPLE_ASSESSMENT,
            modules=SAMPLE_MODULES,
            prediction=SAMPLE_PREDICTION,
            user_name="Test User",
        )

        assert len(result) > 1024, "PDF is too small (< 1KB)"
        assert len(result) < 500 * 1024, "PDF is too large (> 500KB)"

    def test_pdf_with_low_screening_level(self):
        """PDF should generate successfully for LOW screening level."""
        prediction = {**SAMPLE_PREDICTION, "screening_level": "LOW", "overall_score": 85.2}
        result = generate_assessment_report(
            assessment=SAMPLE_ASSESSMENT,
            modules=SAMPLE_MODULES,
            prediction=prediction,
            user_name="Low Risk User",
        )
        assert result[:5] == b"%PDF-"

    def test_pdf_with_high_screening_level(self):
        """PDF should generate successfully for HIGH screening level."""
        prediction = {**SAMPLE_PREDICTION, "screening_level": "HIGH", "overall_score": 32.1}
        result = generate_assessment_report(
            assessment=SAMPLE_ASSESSMENT,
            modules=SAMPLE_MODULES,
            prediction=prediction,
            user_name="High Risk User",
        )
        assert result[:5] == b"%PDF-"

    def test_pdf_with_all_modules_skipped(self):
        """PDF should handle all-skipped modules gracefully."""
        empty_modules = [
            {"module_type": m, "status": "skipped", "score": None, "features": {}}
            for m in ["typing", "memory", "reaction", "speech", "facial"]
        ]
        prediction = {
            **SAMPLE_PREDICTION,
            "modalities_present": {k: False for k in ["typing", "memory", "reaction", "speech", "facial"]},
            "module_scores": {k: None for k in ["typing", "memory", "reaction", "speech", "facial"]},
        }

        result = generate_assessment_report(
            assessment=SAMPLE_ASSESSMENT,
            modules=empty_modules,
            prediction=prediction,
            user_name="Skip All User",
        )
        assert result[:5] == b"%PDF-"

    def test_pdf_with_empty_distribution(self):
        """PDF should handle empty model distribution."""
        prediction = {**SAMPLE_PREDICTION, "model_distribution": {}}
        result = generate_assessment_report(
            assessment=SAMPLE_ASSESSMENT,
            modules=SAMPLE_MODULES,
            prediction=prediction,
            user_name="No Distribution User",
        )
        assert result[:5] == b"%PDF-"

    def test_pdf_with_missing_user_name(self):
        """PDF should use default name when none provided."""
        result = generate_assessment_report(
            assessment=SAMPLE_ASSESSMENT,
            modules=SAMPLE_MODULES,
            prediction=SAMPLE_PREDICTION,
        )
        assert result[:5] == b"%PDF-"

    def test_pdf_with_kannada_language(self):
        """PDF should handle Kannada language setting."""
        assessment = {**SAMPLE_ASSESSMENT, "language": "kn"}
        result = generate_assessment_report(
            assessment=assessment,
            modules=SAMPLE_MODULES,
            prediction=SAMPLE_PREDICTION,
            user_name="Kannada User",
        )
        assert result[:5] == b"%PDF-"

    def test_pdf_with_none_overall_score(self):
        """PDF should handle None overall_score gracefully."""
        prediction = {**SAMPLE_PREDICTION, "overall_score": None}
        result = generate_assessment_report(
            assessment=SAMPLE_ASSESSMENT,
            modules=SAMPLE_MODULES,
            prediction=prediction,
            user_name="No Score User",
        )
        assert result[:5] == b"%PDF-"
