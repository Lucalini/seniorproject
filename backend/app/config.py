from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "POLI(SLO) API"
    allowed_origins: str = "http://localhost:5173"

    def allowed_origins_list(self) -> list[str]:
        # Comma-separated
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()

