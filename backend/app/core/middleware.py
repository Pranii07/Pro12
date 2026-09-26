"""
NeuroScreen — Security Middleware
====================================
Provides ASGI middleware for:
  - Security response headers (CSP, X-Frame-Options, HSTS, etc.)
  - Request ID tracing (X-Request-ID header)
  - Request logging with timing

These should be registered in main.py via add_middleware().

Reference:
  - OWASP Secure Headers: https://owasp.org/www-project-secure-headers/
"""

from __future__ import annotations

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("neuroscreen.middleware")


# -------------------------------------------------------
# Security Headers Middleware
# -------------------------------------------------------

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds security-related HTTP response headers to every response.

    Headers applied:
      - X-Content-Type-Options: nosniff
      - X-Frame-Options: DENY
      - X-XSS-Protection: 1; mode=block
      - Referrer-Policy: strict-origin-when-cross-origin
      - Permissions-Policy: camera=(), microphone=(), geolocation=()
      - Content-Security-Policy: default-src 'self'; ...
      - Strict-Transport-Security: max-age=... (production only)
    """

    def __init__(self, app, is_production: bool = False):
        super().__init__(app)
        self.is_production = is_production

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        # Prevent MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Legacy XSS protection (modern browsers use CSP instead)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Restrict browser features (camera/mic are used transiently
        # via the browser's own permission system, not via iframes)
        response.headers["Permissions-Policy"] = (
            "camera=(self), microphone=(self), geolocation=()"
        )

        # Content Security Policy — allow self, inline styles (for UI libs),
        # Google Fonts, and Supabase connections
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co; "
            "media-src 'self' blob:; "
            "frame-ancestors 'none'"
        )

        # HSTS — only in production (tells browsers to always use HTTPS)
        if self.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        return response


# -------------------------------------------------------
# Request ID Middleware
# -------------------------------------------------------

class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Adds a unique X-Request-ID header to every request and response.
    Useful for request tracing and debugging across services.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Use existing request ID from client, or generate a new one
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))

        # Store in request state for use in handlers
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id

        return response


# -------------------------------------------------------
# Request Logging Middleware
# -------------------------------------------------------

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Logs incoming requests with method, path, status code, and duration.
    Only logs in a summarized format to avoid noise.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        start_time = time.perf_counter()

        response = await call_next(request)

        duration_ms = (time.perf_counter() - start_time) * 1000

        # Skip logging for health checks and static assets
        path = request.url.path
        if path not in ("/api/health", "/favicon.ico"):
            logger.info(
                "%s %s → %d (%.1fms)",
                request.method,
                path,
                response.status_code,
                duration_ms,
            )

        return response
