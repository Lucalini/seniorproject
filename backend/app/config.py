from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


_BACKEND_DIR = Path(__file__).resolve().parents[1]  # .../backend
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    # Load env vars from backend/.env regardless of current working directory.
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), env_file_encoding="utf-8", extra="ignore")

    app_name: str = "POLI(SLO) API"
    allowed_origins: str = "http://localhost:5173"

    # Supabase (keep keys on backend only)
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None

    def allowed_origins_list(self) -> list[str]:
        # Comma-separated
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()

