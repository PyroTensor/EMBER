"""``GET /api/presets`` use case: mission cabin presets from the DB (snapshot when offline)."""

from __future__ import annotations

from app.repositories.interfaces import PresetReader
from app.schemas.preset import Preset


class PresetService:
    def __init__(self, reader: PresetReader) -> None:
        self._reader = reader

    async def list(self) -> list[Preset]:
        """Presets in ``sort_order`` (the order of ``presets.json`` at ingestion time)."""
        rows = await self._reader.list_ordered()
        return [Preset.model_validate(row) for row in rows]


__all__ = ["PresetService"]
