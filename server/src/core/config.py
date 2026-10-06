"""Application settings, loaded from the environment.

Secrets deliberately have **no defaults**. A missing SECRET_KEY should stop the
process at startup with a clear error, not silently boot with a value an
attacker can read in the source history.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- environment ---------------------------------------------------
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    LOG_LEVEL: str = "INFO"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    # --- database ------------------------------------------------------
    POSTGRES_USER: str = "admin"
    # Local-development default only, matching compose.yml. Production
    # supplies this from the environment / a secrets manager.
    POSTGRES_PASSWORD: str = "admin123"  # noqa: S105
    POSTGRES_DB: str = "medicine_scanner"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432

    # Set directly to override the composed URL (managed Postgres, tests, ...).
    DATABASE_URL_OVERRIDE: str | None = None

    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_ECHO: bool = False

    @computed_field  # type: ignore[prop-decorator]
    @property
    def DATABASE_URL(self) -> str:
        if self.DATABASE_URL_OVERRIDE:
            return self.DATABASE_URL_OVERRIDE
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # --- auth ----------------------------------------------------------
    # No default: the app must refuse to start without one in production.
    SECRET_KEY: str = Field(min_length=32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_TTL_MINUTES: int = 60 * 24 * 7  # 7 days

    # Optional. Google sign-in returns 501 until this is set.
    GOOGLE_CLIENT_ID: str | None = None

    # --- LLM -----------------------------------------------------------
    # Optional. The OCR endpoint degrades to a deterministic fallback parser
    # when unset, rather than failing the request.
    GEMINI_API_KEY: str | None = None
    # gemini-2.5-flash is no longer served to new API keys (404). Verified 
    # working with structured output: 3.5-flash, 3.6-flash, 3.8-flash.
    GEMINI_MODEL: str = "gemini-3.6-flash"
    GEMINI_TIMEOUT_SECONDS: float = 20.0

    # --- HTTP ----------------------------------------------------------
    # Comma-separated. React Native does not enforce CORS, but Expo web does.
    CORS_ORIGINS: str = ""
    # Comma-separated Host header allowlist. "*" disables the check.
    ALLOWED_HOSTS: str = "*"

    RATE_LIMIT_AUTH: str = "10/minute"
    RATE_LIMIT_SCAN: str = "60/minute"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def allowed_hosts(self) -> list[str]:
        return [h.strip() for h in self.ALLOWED_HOSTS.split(",") if h.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached so the .env file is read once per process.

    Also gives tests a single place to clear via ``get_settings.cache_clear()``.
    """
    return Settings()  # type: ignore[call-arg]


env = get_settings()
