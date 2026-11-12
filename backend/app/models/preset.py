"""``presets``: named cabin configurations (the 6 ``CabinConfig`` fields) shown in the UI."""

from __future__ import annotations

from sqlalchemy import Float, Integer, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Preset(Base):
    __tablename__ = "presets"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)

    # CabinConfig
    oxygen_pct: Mapped[float] = mapped_column(Float)
    pressure_kpa: Mapped[float] = mapped_column(Float)
    flow_velocity_cm_s: Mapped[float] = mapped_column(Float)
    gravity_g: Mapped[float] = mapped_column(Float)
    fuel_material: Mapped[str] = mapped_column(Text)
    diluent_gas: Mapped[str] = mapped_column(Text)

    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
