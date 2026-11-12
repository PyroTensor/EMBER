"""``telemetry`` table access (write side; read methods arrive in B6.1)."""

from __future__ import annotations

from app.models.telemetry import Telemetry
from app.repositories.base import SqlRepository


class PgTelemetryRepository(SqlRepository[Telemetry]):
    model = Telemetry
    conflict_cols = ("experiment_id",)


__all__ = ["PgTelemetryRepository"]
