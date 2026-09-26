"""
NeuroScreen — Supabase Server-Side Client
==========================================
Provides a Supabase client using the SERVICE ROLE key for backend operations
that need to bypass Row Level Security (e.g., inserting predictions, generating reports).

IMPORTANT: The service role key must NEVER be exposed in frontend code.
It is only used server-side in the FastAPI backend.
"""

from __future__ import annotations

from typing import Optional

from supabase import create_client, Client

from app.core.config import get_settings


_admin_client: Optional[Client] = None


def get_supabase_admin() -> Optional[Client]:
    """
    Get a Supabase client with SERVICE ROLE privileges.
    Bypasses RLS — use only for backend operations.

    Returns None if Supabase is not configured (graceful degradation for dev).
    """
    global _admin_client
    if _admin_client is not None:
        return _admin_client

    settings = get_settings()

    if not settings.supabase_url or not settings.supabase_service_role_key:
        import logging
        logging.warning(
            "[NeuroScreen] Supabase not configured. "
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env. "
            "Database operations will not work."
        )
        return None

    _admin_client = create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
    return _admin_client


def get_supabase_anon() -> Optional[Client]:
    """
    Get a Supabase client with ANON privileges.
    Respects RLS — use for user-scoped operations where RLS provides
    the security boundary.

    Returns None if Supabase is not configured.
    """
    settings = get_settings()

    if not settings.supabase_url or not settings.supabase_anon_key:
        return None

    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
    )
