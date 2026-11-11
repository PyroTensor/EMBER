"""GET /api/health endpoint."""
from __future__ import annotations

from fastapi import APIRouter

from app.db.session import get_health_stats
from app.llm.provider import get_llm_provider

router = APIRouter(tags=["health"])


@router.get("/api/health")
def get_health() -> dict:
    stats = get_health_stats()
    return {
        "status": "ok" if stats["test_runs"] > 0 else "degraded",
        "db": stats["db"],
        "test_runs": stats["test_runs"],
        "chunks": stats["chunks"],
        "llm_provider": get_llm_provider().name,
        "schema_version": "v1",
        "extra_telemetry_keys": stats["extra_telemetry_keys"],
    }
