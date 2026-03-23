"""Application configuration from environment."""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """FocusFlow API settings."""

    app_name: str = "FocusFlow API"
    debug: bool = False

    # Database (set DATABASE_URL in .env for PostgreSQL). Default to SQLite for local dev.
    database_url: str = "sqlite:///./focusflow.db"

    # Auth
    secret_key: str = "change-me-in-production-use-env"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 1 week

    # File storage (local for MVP)
    upload_dir: str = "./uploads"
    max_upload_mb: int = 50

    # LLM (OpenAI-compatible)
    openai_api_key: str = ""
    openai_base_url: str | None = None  # for other providers
    embedding_model: str = "text-embedding-3-small"
    chat_model: str = "gpt-4o-mini"

    # Chunking
    chunk_target_words_min: int = 150
    chunk_target_words_max: int = 350

    # Intervention
    idle_threshold_seconds: int = 90
    revisit_threshold: int = 2

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
