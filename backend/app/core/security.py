"""
NeuroScreen — JWT Security & Authentication Dependencies
==========================================================
Provides FastAPI dependencies for JWT verification against Supabase Auth.

Supabase uses HS256 (HMAC-SHA256) by default to sign JWTs, verified
against the JWT secret from the Supabase dashboard.

Dependencies:
  - get_current_user: Extracts and verifies JWT, returns TokenData
  - require_admin: Same as above but also checks ADMIN role
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from jose import JWTError, jwt

from app.core.config import Settings, get_settings

logger = logging.getLogger("neuroscreen.security")


# -------------------------------------------------------
# Security scheme (Bearer token)
# -------------------------------------------------------

# HTTPBearer extracts the token from the Authorization header
# auto_error=True means it returns 403 if no token is present
bearer_scheme = HTTPBearer(auto_error=True)


# -------------------------------------------------------
# Token Data
# -------------------------------------------------------

@dataclass
class TokenData:
    """Decoded JWT payload from Supabase Auth."""
    user_id: str           # sub claim
    email: Optional[str]   # email claim
    role: str = "authenticated"  # Supabase role
    app_role: Optional[str] = None  # Role from profiles table (ADMIN, CLINICIAN, USER)
    exp: Optional[int] = None


import json
import base64
import time
import urllib.request
from typing import Optional, Dict, Any

_jwks_cache: Optional[Dict[str, Any]] = None
_jwks_last_fetched: float = 0.0


def get_supabase_jwks(supabase_url: str) -> Optional[Dict[str, Any]]:
    """Fetch and cache Supabase public keys (JWKS) for verifying ES256 tokens."""
    global _jwks_cache, _jwks_last_fetched
    now = time.time()
    if _jwks_cache and (now - _jwks_last_fetched < 3600):
        return _jwks_cache

    if not supabase_url:
        return _jwks_cache

    try:
        url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        req = urllib.request.Request(url, headers={"User-Agent": "NeuroScreen-Backend"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            _jwks_cache = json.loads(resp.read().decode("utf-8"))
            _jwks_last_fetched = now
            logger.info("Fetched Supabase JWKS public keys successfully.")
    except Exception as e:
        logger.warning(f"Could not fetch Supabase JWKS from {supabase_url}: {e}")

    return _jwks_cache


# -------------------------------------------------------
# JWT Verification
# -------------------------------------------------------

def verify_jwt(token: str, settings: Settings) -> TokenData:
    """
    Decode and verify a Supabase-issued JWT.

    Supabase uses ES256 (asymmetric ECDSA) for user sessions in newer projects,
    or HS256 (symmetric HMAC) with the project JWT secret.
    We detect the algorithm from the token header and verify accordingly.
    """
    if not settings.supabase_jwt_secret and not settings.supabase_url:
        logger.error("JWT verification is not configured.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT verification is not configured. Set SUPABASE_JWT_SECRET or SUPABASE_URL.",
        )

    try:
        header_segment = token.split(".")[0]
        padding = "=" * ((4 - len(header_segment) % 4) % 4)
        header_bytes = base64.urlsafe_b64decode(header_segment + padding)
        header = json.loads(header_bytes.decode("utf-8"))
        alg = header.get("alg", "HS256")
    except Exception as e:
        logger.warning(f"Failed to parse JWT header: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if alg == "ES256":
        jwks = get_supabase_jwks(settings.supabase_url)
        if not jwks:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Supabase JWKS public key unavailable.",
            )
        verification_key = jwks
        allowed_algorithms = ["ES256"]
    elif alg == "HS256":
        if not settings.supabase_jwt_secret:
            logger.error("SUPABASE_JWT_SECRET is not configured.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="JWT verification is not configured. Set SUPABASE_JWT_SECRET.",
            )
        verification_key = settings.supabase_jwt_secret
        allowed_algorithms = ["HS256"]
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Unsupported token algorithm: {alg}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            token,
            verification_key,
            algorithms=allowed_algorithms,
            options={"verify_aud": False, "leeway": 60},
        )
    except JWTError as e:
        logger.warning(f"JWT verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract claims
    user_id = payload.get("sub")
    if not user_id:
        logger.warning("JWT is missing 'sub' claim.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check expiration explicitly with leeway
    exp = payload.get("exp")
    if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < (datetime.now(timezone.utc) - timedelta(seconds=60)):
        logger.warning("JWT has expired.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return TokenData(
        user_id=user_id,
        email=payload.get("email"),
        role=payload.get("role", "authenticated"),
        exp=exp,
    )


# -------------------------------------------------------
# FastAPI Dependencies
# -------------------------------------------------------

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> TokenData:
    """
    FastAPI dependency: extract and verify JWT from Authorization header.
    Returns TokenData with user info.
    """
    return verify_jwt(credentials.credentials, settings)


async def require_admin(
    user: TokenData = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> TokenData:
    """
    FastAPI dependency: same as get_current_user but also verifies ADMIN role.

    This checks the user's role from the profiles table via Supabase.
    For the initial implementation, we check the app_role which is fetched
    from the profiles table by the route handler. In a production system,
    you might embed the role in a custom JWT claim.

    For now, we do a lightweight check: query the profiles table.

    Usage:
        @router.get("/admin-only")
        async def admin_route(user: TokenData = Depends(require_admin)):
            return {"admin": user.user_id}
    """
    from app.core.supabase_client import get_supabase_admin

    supabase = get_supabase_admin()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin verification unavailable. Supabase not configured.",
        )

    try:
        result = supabase.table("profiles").select("role").eq("id", user.user_id).single().execute()
        if result.data and result.data.get("role") == "ADMIN":
            user.app_role = "ADMIN"
            return user
    except Exception:
        pass

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admin access required.",
    )
