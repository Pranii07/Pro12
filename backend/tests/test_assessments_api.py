"""
NeuroScreen — Assessment API Endpoint Tests
=============================================
Tests for assessment CRUD operations and module result submission.

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
    "status": "in_progress",
    "started_at": "2026-09-16T10:00:00Z",
    "completed_at": None,
    "created_at": "2026-09-16T10:00:00Z",
    "updated_at": "2026-09-16T10:00:00Z",
}


# -------------------------------------------------------
# Tests: GET /api/assessments
# -------------------------------------------------------

class TestListAssessments:
    """Tests for the assessment listing endpoint."""

    @patch("app.api.assessments.get_supabase_admin")
    def test_list_assessments_empty(self, mock_supabase, client):
        """Should return empty list when no assessments exist."""
        mock_db = MagicMock()
        mock_supabase.return_value = mock_db

        # Build mock chain that supports .select().eq().order().range().eq().execute()
        mock_chain = MagicMock()
        mock_chain.select.return_value = mock_chain
        mock_chain.eq.return_value = mock_chain
        mock_chain.order.return_value = mock_chain
        mock_chain.range.return_value = mock_chain

        mock_result = MagicMock()
        mock_result.data = []
        mock_chain.execute.return_value = mock_result

        mock_db.table.return_value = mock_chain

        response = client.get("/api/assessments")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_assessments_unauthenticated(self, unauthenticated_client):
        """Should return 401/403 for unauthenticated requests."""
        response = unauthenticated_client.get("/api/assessments")
        assert response.status_code in (401, 403)


# -------------------------------------------------------
# Tests: POST /api/assessments
# -------------------------------------------------------

class TestCreateAssessment:
    """Tests for the assessment creation endpoint."""

    @patch("app.api.assessments.get_supabase_admin")
    def test_create_assessment(self, mock_supabase, client):
        """Should create a new assessment when no in-progress one exists."""
        mock_db = MagicMock()
        mock_supabase.return_value = mock_db

        call_count = [0]

        def table_side_effect(table_name):
            call_count[0] += 1
            mock_chain = MagicMock()
            mock_chain.select.return_value = mock_chain
            mock_chain.insert.return_value = mock_chain
            mock_chain.eq.return_value = mock_chain

            mock_result = MagicMock()
            if call_count[0] == 1:
                # First call: check for in-progress → return empty
                mock_result.data = []
            else:
                # Second call: insert → return created assessment
                mock_result.data = [MOCK_ASSESSMENT]

            mock_chain.execute.return_value = mock_result
            return mock_chain

        mock_db.table.side_effect = table_side_effect

        response = client.post("/api/assessments", json={"language": "en"})
        assert response.status_code == 201

    @patch("app.api.assessments.get_supabase_admin")
    def test_create_assessment_conflict(self, mock_supabase, client):
        """Should return 409 when user already has an in-progress assessment."""
        mock_db = MagicMock()
        mock_supabase.return_value = mock_db

        mock_chain = MagicMock()
        mock_chain.select.return_value = mock_chain
        mock_chain.eq.return_value = mock_chain

        # Return existing in-progress assessment
        mock_result = MagicMock()
        mock_result.data = [{"id": "existing-assessment"}]
        mock_chain.execute.return_value = mock_result

        mock_db.table.return_value = mock_chain

        response = client.post("/api/assessments", json={"language": "en"})
        assert response.status_code == 409

    def test_create_assessment_unauthenticated(self, unauthenticated_client):
        """Should return 401/403 for unauthenticated requests."""
        response = unauthenticated_client.post("/api/assessments", json={"language": "en"})
        assert response.status_code in (401, 403)


# -------------------------------------------------------
# Tests: POST /api/assessments/{id}/modules
# -------------------------------------------------------

class TestSubmitModuleResult:
    """Tests for module result submission."""

    def test_submit_module_unauthenticated(self, unauthenticated_client):
        """Should return 401/403 for unauthenticated requests."""
        response = unauthenticated_client.post(
            "/api/assessments/assessment-001/modules",
            json={
                "module_type": "typing",
                "status": "completed",
                "features": {"wpm": 45.2},
                "score": 72.0,
            },
        )
        assert response.status_code in (401, 403)
