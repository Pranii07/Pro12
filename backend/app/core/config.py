"""
NeuroScreen — Backend Configuration
====================================
Pydantic Settings class that reads configuration from environment variables.
Used by FastAPI for Supabase connection, JWT verification, CORS, and ML model paths.

All secrets are loaded from .env (never hardcoded). See .env.example for the full list.
"""

from __future__ import annotations

from pathlib import Path
from typing import List

from pydantic import Field, AliasChoices
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # -------------------------------------------------------
    # Supabase
    # -------------------------------------------------------
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # -------------------------------------------------------
    # FastAPI Server
    # -------------------------------------------------------
    backend_host: str = "0.0.0.0"
    backend_port: int = Field(default=8000, validation_alias=AliasChoices("PORT", "BACKEND_PORT"))
    backend_env: str = "development"  # development | staging | production

    # -------------------------------------------------------
    # CORS — comma-separated origins
    # -------------------------------------------------------
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origin_list(self) -> List[str]:
        """Parse CORS origins string into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    # -------------------------------------------------------
    # ML Model Paths
    # -------------------------------------------------------
    ml_model_path: str = "ml/models/best_model.joblib"
    ml_model_metadata_path: str = "ml/models/model_metadata.json"

    @staticmethod
    def _resolve_relative_path(path_str: str) -> str:
        """Resolve a path that may be relative to backend/ or the project root."""
        p = Path(path_str)
        if p.is_absolute() and p.exists():
            return str(p)
        if p.exists():
            return str(p.resolve())
        # Check from backend dir
        backend_dir = Path(__file__).resolve().parents[2]
        if (backend_dir / path_str).exists():
            return str((backend_dir / path_str).resolve())
        # Check from project workspace root (parent of backend)
        workspace_root = Path(__file__).resolve().parents[3]
        if (workspace_root / path_str).exists():
            return str((workspace_root / path_str).resolve())
        return str(p)

    @property
    def resolved_ml_model_path(self) -> str:
        return self._resolve_relative_path(self.ml_model_path)

    @property
    def resolved_ml_model_metadata_path(self) -> str:
        return self._resolve_relative_path(self.ml_model_metadata_path)

    @property
    def resolved_ml_preprocessor_path(self) -> str:
        return self._resolve_relative_path(
            self.ml_model_path.replace("best_model.joblib", "preprocessor.joblib")
        )

    # -------------------------------------------------------
    # Speech-to-Text (Vosk)
    # -------------------------------------------------------
    vosk_model_path_en: str = "ml/models/vosk-model-small-en-us"
    vosk_model_path_kn: str = "ml/models/vosk-model-small-kn"


    # -------------------------------------------------------
    # Rate Limiting
    # -------------------------------------------------------
    rate_limit_auth: int = 20     # requests per minute for auth endpoints
    rate_limit_predict: int = 10  # requests per minute for prediction endpoints

    # -------------------------------------------------------
    # Security
    # -------------------------------------------------------
    max_upload_size_mb: int = 10  # max request body size for file uploads
    trusted_hosts: str = "*"      # comma-separated trusted host names

    # -------------------------------------------------------
    # Computed Properties
    # -------------------------------------------------------

    @property
    def is_production(self) -> bool:
        return self.backend_env == "production"

    @property
    def is_development(self) -> bool:
        return self.backend_env == "development"

    # -------------------------------------------------------
    # Pydantic Settings Config
    # -------------------------------------------------------
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore",
    }


_settings: Settings | None = None


def get_settings() -> Settings:
    """
    Cached settings instance. Call this instead of instantiating Settings directly.
    Uses module-level caching so the settings are re-read on process restart.
    """
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
