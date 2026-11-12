"""Application settings, read from environment variables.

``get_settings()`` first calls ``load_dotenv(backend/.env)`` to copy the file into ``os.environ``; variables
already set in the real environment win (``override=False``). Settings then reads only ``os.environ``.

Field names are the env var names (case-sensitive, UPPERCASE). DB credentials are required;
everything else has a safe local default and is range-checked. ``DATABASE_URL`` and
``DATABASE_URL_READONLY`` are built from the ``DB_*`` parts. Guard rails reject unsafe values in ``prod``.
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Final
from urllib.parse import quote

from dotenv import load_dotenv
from pydantic import Field, SecretStr, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app.core.constants import EMBED_DIM as DEFAULT_EMBED_DIM

BASE_DIR: Final[Path] = Path(__file__).resolve().parents[2]
ENV_FILE: Final[Path] = BASE_DIR / ".env"

_PLACEHOLDER_SECRETS: Final[frozenset[str]] = frozenset(
    {"", "changeme", "change-me", "secret", "password", "admin", "postgres", "ember", "ember_ro"}
)


class Environment(StrEnum):
    DEV = "dev"
    TEST = "test"
    PROD = "prod"

    @property
    def is_production(self) -> bool:
        return self is Environment.PROD


class LogLevel(StrEnum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class DataBackend(StrEnum):
    AUTO = "auto"  # probe Postgres, fall back to the snapshot
    POSTGRES = "postgres"
    SNAPSHOT = "snapshot"


class LlmProvider(StrEnum):
    HEURISTIC = "heuristic"  # no key needed; tests and eval use it
    GEMINI = "gemini"
    OPENAI = "openai"


def _split_csv(value: Any) -> Any:
    """Accept a JSON list (``["a","b"]``) or a CSV string (``a,b``) for list settings."""
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        if text.startswith("["):
            import json

            return json.loads(text)
        return [item.strip() for item in text.split(",") if item.strip()]
    return value


def _pg_url(driver: str, user: str, password: str, host: str, port: int, name: str) -> str:
    auth = f"{quote(user, safe='')}:{quote(password, safe='')}"
    return f"{driver}://{auth}@{host}:{port}/{quote(name, safe='')}"


class Settings(BaseSettings):
    # ── app ──────────────────────────────────────────────────────────
    ENV: Environment = Environment.DEV
    LOG_LEVEL: LogLevel = LogLevel.INFO
    LOG_JSON: bool = False

    # ── database (required credentials) ──────────────────────────────
    DB_HOST: str = "localhost"
    DB_PORT: int = Field(default=5432, ge=1, le=65535)
    DB_USER: str
    DB_PASSWORD: SecretStr
    DB_NAME: str
    # read-only role (created by migration 0004); used by GET endpoints and the RAG sql_tool
    DB_RO_USER: str = "ember_ro"
    DB_RO_PASSWORD: SecretStr = SecretStr("ember_ro")
    DB_POOL_SIZE: int = Field(default=5, ge=1, le=100)
    DB_CONNECT_TIMEOUT_S: float = Field(default=2.0, gt=0, le=60)

    # ── data backend ─────────────────────────────────────────────────
    DATA_BACKEND: DataBackend = DataBackend.AUTO
    DB_PROBE_TTL_S: float = Field(default=15.0, ge=0, le=3600)
    # relative paths resolve against backend/
    SNAPSHOT_PATH: Path = Path("data/.cache/store.json")
    SEED_DIR: Path = Path("data/seed")

    # ── HTTP ─────────────────────────────────────────────────────────
    CORS_ORIGINS: Annotated[list[str], NoDecode] = Field(default_factory=lambda: ["http://localhost:3000"])

    # ── LLM ──────────────────────────────────────────────────────────
    LLM_PROVIDER: LlmProvider = LlmProvider.HEURISTIC
    LLM_MODEL: str = "gemini-2.5-flash"
    GEMINI_API_KEY: SecretStr = SecretStr("")
    OPENAI_API_KEY: SecretStr = SecretStr("")

    # ── embeddings ───────────────────────────────────────────────────
    EMBED_MODEL: str = "BAAI/bge-small-en-v1.5"
    EMBED_DIM: int = Field(default=DEFAULT_EMBED_DIM, ge=1, le=8192)
    EMBED_WARMUP: bool = True

    # ── RAG ──────────────────────────────────────────────────────────
    RAG_TOP_K: int = Field(default=5, ge=1, le=50)
    RAG_MAX_REWRITES: int = Field(default=2, ge=0, le=5)
    RAG_ANSWER_EVIDENCE: int = Field(default=8, ge=1, le=50)

    # ── tracing (optional, extra "tracing") ──────────────────────────
    LANGSMITH_API_KEY: SecretStr = SecretStr("")
    LANGSMITH_PROJECT: str = "ember"

    # No env_file here: .env is loaded into os.environ by load_dotenv() in get_settings().
    model_config = SettingsConfigDict(
        extra="ignore",
        case_sensitive=True,
        validate_default=True,
    )

    # ── field validators ─────────────────────────────────────────────
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_csv_lists(cls, value: Any) -> Any:
        return _split_csv(value)

    @field_validator("CORS_ORIGINS")
    @classmethod
    def _check_origins(cls, value: list[str]) -> list[str]:
        if "*" in value:
            raise ValueError("CORS_ORIGINS cannot contain '*'; list exact origins")
        return [origin.rstrip("/") for origin in value]

    @field_validator("SNAPSHOT_PATH", "SEED_DIR")
    @classmethod
    def _resolve_path(cls, value: Path) -> Path:
        return value if value.is_absolute() else BASE_DIR / value

    # ── cross-field guard rails ──────────────────────────────────────
    @model_validator(mode="after")
    def _enforce_guard_rails(self) -> Settings:
        if self.LLM_PROVIDER is LlmProvider.GEMINI and not self.GEMINI_API_KEY.get_secret_value():
            raise ValueError("GEMINI_API_KEY is required when LLM_PROVIDER=gemini")
        if self.LLM_PROVIDER is LlmProvider.OPENAI and not self.OPENAI_API_KEY.get_secret_value():
            raise ValueError("OPENAI_API_KEY is required when LLM_PROVIDER=openai")

        if self.ENV.is_production:
            for name in ("DB_PASSWORD", "DB_RO_PASSWORD"):
                secret: SecretStr = getattr(self, name)
                if secret.get_secret_value().strip().lower() in _PLACEHOLDER_SECRETS:
                    raise ValueError(f"{name} is a placeholder value; set a real password in prod")
            insecure = [o for o in self.CORS_ORIGINS if o.startswith("http://")]
            if insecure:
                raise ValueError(f"CORS_ORIGINS must use https in prod: {insecure}")
        return self

    # ── derived values ───────────────────────────────────────────────
    @computed_field(repr=False)  # type: ignore[prop-decorator]
    @property
    def DATABASE_URL(self) -> str:
        return _pg_url(
            "postgresql+asyncpg",
            self.DB_USER,
            self.DB_PASSWORD.get_secret_value(),
            self.DB_HOST,
            self.DB_PORT,
            self.DB_NAME,
        )

    @computed_field(repr=False)  # type: ignore[prop-decorator]
    @property
    def DATABASE_URL_READONLY(self) -> str:
        return _pg_url(
            "postgresql+asyncpg",
            self.DB_RO_USER,
            self.DB_RO_PASSWORD.get_secret_value(),
            self.DB_HOST,
            self.DB_PORT,
            self.DB_NAME,
        )

    @property
    def SAFE_DATABASE_URL(self) -> str:
        """DATABASE_URL with the password masked, for logs."""
        user, name = quote(self.DB_USER, safe=""), quote(self.DB_NAME, safe="")
        return f"postgresql+asyncpg://{user}:***@{self.DB_HOST}:{self.DB_PORT}/{name}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    load_dotenv(ENV_FILE, override=False, encoding="utf-8")
    return Settings()  # required DB_* fields come from the environment (incl. the loaded .env)


__all__ = [
    "BASE_DIR",
    "ENV_FILE",
    "DataBackend",
    "Environment",
    "LlmProvider",
    "LogLevel",
    "Settings",
    "get_settings",
]
