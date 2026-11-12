"""``telemetry``: per-run time series (``time_s``, ``flame_radius_mm``, ...) stored as one JSONB document."""

from __future__ import annotations

from typing import Any

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Telemetry(Base):
    __tablename__ = "telemetry"

    experiment_id: Mapped[str] = mapped_column(
        ForeignKey("test_runs.experiment_id", ondelete="CASCADE"), primary_key=True
    )
    series: Mapped[dict[str, Any]] = mapped_column(JSONB)
