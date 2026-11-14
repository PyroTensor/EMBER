"""``combustion_findings`` table access (I10): bulk upsert + per-source replace for idempotent re-ingests."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from sqlalchemy import delete, func, or_, select

from app.models.combustion_finding import CombustionFinding
from app.repositories.base import SqlRepository


class PgCombustionFindingRepository(SqlRepository[CombustionFinding]):
    model = CombustionFinding
    conflict_cols = ("finding_id",)

    async def replace_for_docs(self, doc_ids: Iterable[str], source_files: Iterable[str] = ()) -> int:
        """Delete the findings of re-ingested documents (and CSV files), so stale findings disappear.

        Call before ``upsert_many`` in the same transaction (same idea as chunks). Returns rows deleted.
        """
        docs, files = list(doc_ids), list(source_files)
        if not docs and not files:
            return 0
        conds = []
        if docs:
            conds.append(CombustionFinding.source_doc_id.in_(docs))
        if files:
            conds.append(CombustionFinding.source_file.in_(files))
        result = await self.session.execute(delete(CombustionFinding).where(or_(*conds)))
        return int(getattr(result, "rowcount", 0) or 0)

    async def count(self) -> int:
        return int(await self.session.scalar(select(func.count()).select_from(self.table)) or 0)

    async def list_all(self) -> list[dict[str, Any]]:
        result = await self.session.execute(select(self.table).order_by(self.table.c.finding_id))
        return [dict(row) for row in result.mappings()]


__all__ = ["PgCombustionFindingRepository"]
