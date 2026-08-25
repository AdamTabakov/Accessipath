"""Application configuration.

Environment variables are read via pydantic-settings. Names intentionally
mirror the original Node/Dotnet configuration so existing .env files keep
working: PORT, NODE_ENV, DATABASE_URL, CORS_ORIGINS, OSRM_URL,
NOMINATIM_URL, OVERPASS_URL, UPLOAD_DIR, APP_URL, JWT_SECRET,
JWT_EXPIRES_IN, VERIFICATION_CODE_TTL_MINUTES, RESEND_API_KEY, RESEND_FROM.
"""

import os

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Dev-only fallback; must be set via JWT_SECRET env var in production.
DEV_JWT_SECRET = "accessipath-dev-secret-change-in-prod"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    port: int = 4000
    node_env: str = "development"
    database_url: str = ""
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    osrm_url: str = "https://router.project-osrm.org"
    nominatim_url: str = "https://nominatim.openstreetmap.org"
    overpass_url: str = "https://overpass-api.de/api/interpreter"
    upload_dir: str = "uploads"
    max_upload_bytes: int = 8 * 1024 * 1024  # 8 MB
    body_limit: str = "12mb"

    app_url: str = "http://localhost:5173"
    jwt_secret: str = os.getenv("JWT_SECRET", DEV_JWT_SECRET)
    jwt_expires_in: str = "7d"
    verification_code_ttl_minutes: int = 15
    resend_api_key: str = ""
    resend_from: str = "AccessiPath <onboarding@resend.dev>"

    @model_validator(mode="after")
    def _require_prod_secrets(self) -> "Settings":
        if self.is_prod:
            if not self.jwt_secret or self.jwt_secret == DEV_JWT_SECRET:
                raise ValueError("JWT_SECRET must be set to a secret value in production")
            if not self.cors_origins.strip():
                raise ValueError("CORS_ORIGINS must be set in production")
        return self

    @property
    def is_prod(self) -> bool:
        return self.node_env == "production"

    @property
    def is_test(self) -> bool:
        return self.node_env == "test"

    @property
    def cors_origin_list(self) -> list[str]:
        return [s.strip() for s in self.cors_origins.split(",") if s.strip()]

    @property
    def verification_code_ttl_ms(self) -> int:
        return self.verification_code_ttl_minutes * 60_000


settings = Settings()