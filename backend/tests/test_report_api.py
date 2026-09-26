"""
NeuroScreen — Report API Endpoint Tests
==========================================
Tests for the report generation, listing, and download API endpoints.

Uses mocked Supabase client to avoid external dependencies.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from main import app
from app.core.security import get_current_user, TokenData


# -------------------------------------------------------
# Fixtures
# -------------------------------------------------------

MOCK_USER = TokenData(
    user_id="test-user-123",
    email="test@neuroscreen.dev",
    role="authenticated",
    app_role="USER",
)


def mock_get_current_user():
    return MOCK_USER


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = mock_get_current_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def unauthenticated_client():
    app.dependency_overrides.clear()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# -------------------------------------------------------
# Mock Data
# -------------------------------------------------------

MOCK_ASSESSMENT = {
    "id": "assessment-001",
    "user_id": "test-user-123",
    "language": "en",
    "status": "completed",
    "started_at": "2026-09-16T10:00:00Z",
    "completed_at": "2026-09-16T10:30:00Z",
}

MOCK_MODULES = [
    {
        "id": "mod-001",
        "assessment_id": "assessment-001",
        "module_type": "typing",
        "status": "completed",
        "score": 72,
        "features": {"wpm": 45.2, "cpm": 225.5},
    },
]

MOCK_PREDICTION = {
    "id": "pred-001",
    "assessment_id": "assessment-001",
    "screening_level": "LOW",
    "overall_score": 78.5,
    "model_distribution": {"LOW": 0.70, "MODERATE": 0.25, "HIGH": 0.05},
    "module_scores": {"typing": 72},
    "modalities_present": {"typing": True, "memory": False, "reaction": False, "speech": False, "facial": False},
    "model_name": "SVM",
    "model_version": "1.0.0",
}

MOCK_PROFILE = {
    "id": "test-user-123",
    "full_name": "Test User",
    "role": "USER",
}

MOCK_REPORT_ROW = {
    "id": "report-001",
    "assessment_id": "assessment-001",
    "user_id": "test-user-123",
    "storage_path": "test-user-123/neuroscreen_report_assessme_20260916.pdf",
    "file_name": "neuroscreen_report_assessme_20260916.pdf",
    "file_size_bytes": 7500,
    "generated_at": "2026-09-16T10:35:00Z",
    "created_at": "2026-09-16T10:35:00Z",
}


# -------------------------------------------------------
# Helper: Mock Supabase chain
# -------------------------------------------------------

def create_mock_chain(data, is_single=False):
    """Create a mock Supabase query chain that returns the given data."""
    mock_result = MagicMock()
    mock_result.data = data

    mock_execute = MagicMock(return_value=mock_result)

    mock_chain = MagicMock()
    mock_chain.select.return_value = mock_chain
    mock_chain.insert.return_value = mock_chain
    mock_chain.eq.return_value = mock_chain
    mock_chain.order.return_value = mock_chain
    mock_chain.single.return_value = mock_chain
    mock_chain.execute = mock_execute

    return mock_chain


# -------------------------------------------------------
# Tests: GET /api/reports
# -------------------------------------------------------

class TestListReports:
    """Tests for the report listing endpoint."""

    @patch("app.api.reports.get_supabase_admin")
    def test_list_reports_empty(self, mock_supabase, client):
        """Should return empty list when no reports exist."""
        mock_db = MagicMock()
        mock_supabase.return_value = mock_db
        mock_db.table.return_value = create_mock_chain([])

        response = client.get("/api/reports")
        assert response.status_code == 200
        assert response.json() == []

    @patch("app.api.reports.get_supabase_admin")
    def test_list_reports_with_data(self, mock_supabase, client):
        """Should return list of report items."""
        mock_db = MagicMock()
        mock_supabase.return_value = mock_db
        mock_db.table.return_value = create_mock_chain([MOCK_REPORT_ROW])

        response = client.get("/api/reports")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == "report-001"
        assert data[0]["file_name"] == MOCK_REPORT_ROW["file_name"]

    def test_list_reports_unauthenticated(self, unauthenticated_client):
        """Should return 403 for unauthenticated requests."""
        response = unauthenticated_client.get("/api/reports")
        assert response.status_code in (401, 403)


# -------------------------------------------------------
# Tests: GET /api/reports/{id}/download
# -------------------------------------------------------

class TestDownloadReport:
    """Tests for the report download endpoint."""

    @patch("app.api.reports.get_supabase_admin")
    def test_download_returns_signed_url(self, mock_supabase, client):
        """Should return a signed URL for an existing report."""
        mock_db = MagicMock()
        mock_supabase.return_value = mock_db
        mock_db.table.return_value = create_mock_chain(MOCK_REPORT_ROW, is_single=True)

        # Mock storage signed URL
        mock_db.storage.from_.return_value.create_signed_url.return_value = {
            "signedURL": "https://storage.supabase.co/signed/test.pdf"
        }

        response = client.get("/api/reports/report-001/download")
        assert response.status_code == 200
        data = response.json()
        assert "download_url" in data
        assert data["report_id"] == "report-001"

    def test_download_unauthenticated(self, unauthenticated_client):
        """Should return 403 for unauthenticated requests."""
        response = unauthenticated_client.get("/api/reports/report-001/download")
        assert response.status_code in (401, 403)

    @patch("app.api.reports.get_supabase_admin")
    def test_download_file_streams_pdf(self, mock_supabase, client):
        """Should stream the PDF binary content directly."""
        mock_db = MagicMock()
        mock_supabase.return_value = mock_db
        mock_db.table.return_value = create_mock_chain(MOCK_REPORT_ROW, is_single=True)
        mock_db.storage.from_.return_value.download.return_value = b"%PDF-1.4 mock pdf content"

        response = client.get("/api/reports/report-001/file")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert "attachment" in response.headers["content-disposition"]
        assert response.content == b"%PDF-1.4 mock pdf content"

    def test_download_file_unauthenticated(self, unauthenticated_client):
        """Should return 401 or 403 for unauthenticated file download."""
        response = unauthenticated_client.get("/api/reports/report-001/file")
        assert response.status_code in (401, 403)


# -------------------------------------------------------
# Tests: POST /api/reports/assessments/{id}/generate
# -------------------------------------------------------

class TestGenerateReport:
    """Tests for the report generation endpoint."""

    @patch("app.api.reports.get_supabase_admin")
    def test_generate_report_success(self, mock_supabase, client):
        """Should generate a PDF and return report metadata."""
        mock_db = MagicMock()
        mock_supabase.return_value = mock_db

        # Set up different table returns for each query
        assessment_chain = create_mock_chain(MOCK_ASSESSMENT, is_single=True)
        modules_chain = create_mock_chain(MOCK_MODULES)
        prediction_chain = create_mock_chain([MOCK_PREDICTION])
        profile_chain = create_mock_chain(MOCK_PROFILE, is_single=True)
        insert_chain = create_mock_chain([MOCK_REPORT_ROW])

        def table_side_effect(table_name):
            if table_name == "assessments":
                return assessment_chain
            elif table_name == "module_results":
                return modules_chain
            elif table_name == "predictions":
                return prediction_chain
            elif table_name == "profiles":
                return profile_chain
            elif table_name == "reports":
                return insert_chain
            return create_mock_chain([])

        mock_db.table.side_effect = table_side_effect

        # Mock storage upload
        mock_db.storage.from_.return_value.upload.return_value = None

        response = client.post("/api/reports/assessments/assessment-001/generate")
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == "report-001"
        assert data["assessment_id"] == "assessment-001"

    def test_generate_unauthenticated(self, unauthenticated_client):
        """Should return 403 for unauthenticated requests."""
        response = unauthenticated_client.post("/api/reports/assessments/assessment-001/generate")
        assert response.status_code in (401, 403)
