"""``GET /api/presets``."""

from __future__ import annotations

from app.schemas.cabin import CabinConfig


class Preset(CabinConfig):
    id: str
    name: str
    description: str


__all__ = ["Preset"]
