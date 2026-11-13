"""``GET /api/health``."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.core.constants import SCHEMA_VERSION
from app.schemas.common import APIModel


class Health(APIModel):
    status: Literal["ok", "degraded"]
    db: bool
    test_runs: int = Field(ge=0)
    chunks: int = Field(ge=0)
    llm_provider: str
    schema_version: str = SCHEMA_VERSION
    extra_telemetry_keys: list[str] = Field(default_factory=list)


__all__ = ["Health"]
