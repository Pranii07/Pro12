"""
NeuroScreen — Security Tests
================================
Tests for JWT verification, auth dependencies, security headers,
and protected route access control.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from jose import jwt

from main import app
from app.core.security import verify_jwt, TokenData, get_current_user
from app.core.config import Settings


# -------------------------------------------------------
# Fixtures
# -------------------------------------------------------

@pytest.fixture
def client():
    """Client without any auth overrides — tests real auth flow."""
    app.dependency_overrides.clear()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def mock_settings():
    """Settings with a test JWT secret."""
    return Settings(
        supabase_jwt_secret="test-jwt-secret-for-unit-tests-only",
        supabase_url="",
        supabase_anon_key="",
        supabase_service_role_key="",
    )


# -------------------------------------------------------
# Tests: JWT Verification
# -------------------------------------------------------

class TestJWTVerification:
    """Tests for the verify_jwt function."""

    def test_valid_token(self, mock_settings):
        """Should decode a valid JWT and return TokenData."""
        payload = {
            "sub": "user-123",
            "email": "test@neuroscreen.dev",
            "role": "authenticated",
            "aud": "authenticated",
            "exp": 9999999999,
        }
        token = jwt.encode(payload, mock_settings.supabase_jwt_secret, algorithm="HS256")

        result = verify_jwt(token, mock_settings)

        assert isinstance(result, TokenData)
        assert result.user_id == "user-123"
        assert result.email == "test@neuroscreen.dev"
        assert result.role == "authenticated"

    def test_invalid_token(self, mock_settings):
        """Should raise HTTPException for invalid token."""
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            verify_jwt("invalid-token-string", mock_settings)
        assert exc_info.value.status_code == 401

    def test_expired_token(self, mock_settings):
        """Should raise HTTPException for expired token."""
        from fastapi import HTTPException

        payload = {
            "sub": "user-123",
            "email": "test@neuroscreen.dev",
            "role": "authenticated",
            "aud": "authenticated",
            "exp": 1000000000,  # Way in the past
        }
        token = jwt.encode(payload, mock_settings.supabase_jwt_secret, algorithm="HS256")

        with pytest.raises(HTTPException) as exc_info:
            verify_jwt(token, mock_settings)
        assert exc_info.value.status_code == 401

    def test_token_missing_sub(self, mock_settings):
        """Should raise HTTPException for token without sub claim."""
        from fastapi import HTTPException

        payload = {
            "email": "test@neuroscreen.dev",
            "role": "authenticated",
            "aud": "authenticated",
            "exp": 9999999999,
        }
        token = jwt.encode(payload, mock_settings.supabase_jwt_secret, algorithm="HS256")

        with pytest.raises(HTTPException) as exc_info:
            verify_jwt(token, mock_settings)
        assert exc_info.value.status_code == 401

    def test_no_jwt_secret_configured(self):
        """Should raise 503 when JWT secret is not configured."""
        from fastapi import HTTPException

        settings = Settings(
            supabase_jwt_secret="",
            supabase_url="",
            supabase_anon_key="",
            supabase_service_role_key="",
        )

        with pytest.raises(HTTPException) as exc_info:
            verify_jwt("any-token", settings)
        assert exc_info.value.status_code == 503

    def test_wrong_secret(self, mock_settings):
        """Should reject token signed with wrong secret."""
        from fastapi import HTTPException

        payload = {
            "sub": "user-123",
            "aud": "authenticated",
            "exp": 9999999999,
        }
        token = jwt.encode(payload, "wrong-secret", algorithm="HS256")

        with pytest.raises(HTTPException) as exc_info:
            verify_jwt(token, mock_settings)
        assert exc_info.value.status_code == 401


# -------------------------------------------------------
# Tests: Protected Routes
# -------------------------------------------------------

class TestProtectedRoutes:
    """Tests that protected routes reject unauthenticated requests."""

    PROTECTED_ENDPOINTS = [
        ("GET", "/api/assessments"),
        ("POST", "/api/assessments"),
        ("GET", "/api/reports"),
        ("GET", "/api/admin/stats"),
        ("GET", "/api/admin/users"),
        ("GET", "/api/admin/model-info"),
    ]

    @pytest.mark.parametrize("method,path", PROTECTED_ENDPOINTS)
    def test_protected_route_rejects_no_auth(self, client, method, path):
        """Protected endpoints should return 401 or 403 without auth."""
        if method == "GET":
            response = client.get(path)
        elif method == "POST":
            response = client.post(path, json={})
        # HTTPBearer returns 401 (missing token) or 403 (forbidden)
        assert response.status_code in (401, 403)


# -------------------------------------------------------
# Tests: Security Headers
# -------------------------------------------------------

class TestSecurityHeaders:
    """Tests that security headers are present in responses."""

    def test_health_endpoint_has_security_headers(self, client):
        """Health endpoint should have security headers."""
        response = client.get("/api/health")

        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"
        assert response.headers.get("X-XSS-Protection") == "1; mode=block"
        assert "strict-origin" in response.headers.get("Referrer-Policy", "")

    def test_request_id_present(self, client):
        """Responses should include X-Request-ID header."""
        response = client.get("/api/health")
        assert response.headers.get("X-Request-ID") is not None
        assert len(response.headers.get("X-Request-ID", "")) > 0

    def test_csp_header_present(self, client):
        """Responses should include Content-Security-Policy header."""
        response = client.get("/api/health")
        csp = response.headers.get("Content-Security-Policy", "")
        assert "default-src" in csp
        assert "frame-ancestors 'none'" in csp


# -------------------------------------------------------
# Tests: Health Endpoint
# -------------------------------------------------------

class TestHealthEndpoint:
    """Tests for the health check endpoint (public)."""

    def test_health_check(self, client):
        """Health endpoint should return 200."""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy" or "status" in data
