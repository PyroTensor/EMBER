"""``test_runs``: one row per combustion test run; columns mirror ``contracts/schema_v1.json``."""

from __future__ import annotations

from typing import Any

from sqlalchemy import Float, ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TestRun(Base):
    __tablename__ = "test_runs"
    __test__ = False  # keep pytest from collecting this class

    # identity
    experiment_id: Mapped[str] = mapped_column(Text, primary_key=True)
    investigation_id: Mapped[str | None] = mapped_column(ForeignKey("investigations.id"))
    program: Mapped[str] = mapped_column(Text, index=True)
    fuel_material: Mapped[str] = mapped_column(Text, index=True)
    fuel_geometry: Mapped[str] = mapped_column(Text)

    # conditions
    gravity_g: Mapped[float] = mapped_column(Float)
    oxygen_pct: Mapped[float] = mapped_column(Float)
    pressure_kpa: Mapped[float] = mapped_column(Float)
    flow_velocity_cm_s: Mapped[float] = mapped_column(Float)
    diluent_gas: Mapped[str] = mapped_column(Text)

    # outcome
    combustion_regime: Mapped[str] = mapped_column(Text, index=True)
    spread_or_burn_rate: Mapped[float | None] = mapped_column(Float)
    peak_radiative_flux_kw_m2: Mapped[float | None] = mapped_column(Float)
    limiting_oxygen_index_pct: Mapped[float | None] = mapped_column(Float)
    burn_duration_s: Mapped[float | None] = mapped_column(Float)

    # provenance
    source_doc_id: Mapped[str | None] = mapped_column(Text)
    source_page: Mapped[int | None] = mapped_column(Integer)

    # escape hatches
    extra_telemetry: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb")
    )
    review_flags: Mapped[list[str]] = mapped_column(
        ARRAY(Text), default=list, server_default=text("'{}'::text[]")
    )
