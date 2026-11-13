"""``GET /api/health`` use case: data counts + DB flag + LLM provider name."""

from __future__ import annotations

from app.repositories.interfaces import StatsReader
from app.schemas.health import Health


class HealthService:
    """Reports service status. ``status`` is ``"degraded"`` when no test runs are loaded."""

    def __init__(self, stats: StatsReader, db_up: bool, llm_name: str) -> None:
        self._stats = stats
        self._db_up = db_up
        self._llm_name = llm_name

    async def get(self) -> Health:
        runs = await self._stats.count_runs()
        chunks = await self._stats.count_chunks()
        extra_keys = await self._stats.extra_telemetry_keys()
        return Health(
            status="ok" if runs > 0 else "degraded",
            db=self._db_up,
            test_runs=runs,
            chunks=chunks,
            llm_provider=self._llm_name,
            extra_telemetry_keys=extra_keys,
        )


__all__ = ["HealthService"]
