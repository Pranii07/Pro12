"""
NeuroScreen — Backend Test Configuration
==========================================
Shared pytest fixtures for FastAPI test client and mock auth.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from main import app
from app.core.security import TokenData


# -------------------------------------------------------
# Mock JWT auth dependency — bypass real Supabase verification
# -------------------------------------------------------

MOCK_USER = TokenData(
    user_id="test-user-123",
    email="test@neuroscreen.dev",
    role="authenticated",
    app_role="USER",
)

MOCK_ADMIN = TokenData(
    user_id="admin-user-456",
    email="admin@neuroscreen.dev",
    role="authenticated",
    app_role="ADMIN",
)


def mock_get_current_user():
    """Override the get_current_user dependency for testing."""
    return MOCK_USER


def mock_get_current_admin():
    """Override for admin user testing."""
    return MOCK_ADMIN


# -------------------------------------------------------
# Fixtures
# -------------------------------------------------------

@pytest.fixture
def client():
    """
    FastAPI test client with mocked JWT authentication.
    All protected routes will receive MOCK_USER as the authenticated user.
    """
    from app.core.security import get_current_user

    app.dependency_overrides[get_current_user] = mock_get_current_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_client():
    """
    FastAPI test client with mocked admin JWT authentication.
    """
    from app.core.security import get_current_user

    app.dependency_overrides[get_current_user] = mock_get_current_admin
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def unauthenticated_client():
    """
    FastAPI test client WITHOUT any auth override.
    Requests will fail auth checks (used for 401 tests).
    """
    app.dependency_overrides.clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
