"""Backend configuration loaded from environment / .env."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://ember:ember@localhost:5432/ember"
    database_url_readonly: str = "postgresql://ember_ro:ember_ro@localhost:5432/ember"

    llm_provider: str = "gemini"  # gemini | openai | anthropic | heuristic
    llm_model: str = "gemini-3.5-flash"
    gemini_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    embed_model: str = "BAAI/bge-small-en-v1.5"
    embed_dim: int = 384

    langsmith_api_key: str = ""
    langsmith_project: str = "ember"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
