import os
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Personalized Travel Itinerary Planner"
    ENVIRONMENT: str = "development"
    JWT_SECRET: str = "default-insecure-secret-key-change-in-production-123456789"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"
    ALLOW_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    CORS_ORIGINS: str = ""
    PORT: int = 8000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins(self) -> List[str]:
        raw = self.CORS_ORIGINS or self.ALLOW_ORIGINS
        if not raw:
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
