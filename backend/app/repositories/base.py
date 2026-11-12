"""Generic async SQL repository: get by primary key + bulk upsert (``INSERT ... ON CONFLICT DO UPDATE``)."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, ClassVar, cast

from sqlalchemy import Table
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

# asyncpg caps a statement at 32767 bind parameters; stay well below it.
_MAX_PARAMS = 30_000


class SqlRepository[ModelT: Base]:
    model: ClassVar[type[Base]]
    conflict_cols: ClassVar[tuple[str, ...]]  # default ON CONFLICT target (usually the primary key)

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @property
    def table(self) -> Table:
        return cast(Table, self.model.__table__)

    async def get(self, id: Any) -> ModelT | None:
        return cast("ModelT | None", await self.session.get(self.model, id))

    async def upsert_many(
        self, rows: list[dict[str, Any]], conflict_cols: Sequence[str] | None = None
    ) -> int:
        """Insert ``rows`` (dicts keyed by column name); on a conflict update the other given columns.

        ``conflict_cols`` defaults to the repository's ``conflict_cols``. Does not commit: the caller owns the
        transaction.
        """
        if not rows:
            return 0
        target = list(conflict_cols or self.conflict_cols)
        given = set(rows[0])
        batch = max(1, _MAX_PARAMS // max(1, len(given)))
        for start in range(0, len(rows), batch):
            stmt = pg_insert(self.table).values(rows[start : start + batch])
            updates = {
                col.name: stmt.excluded[col.name]
                for col in self.table.columns
                if col.name in given and col.name not in target
            }
            if updates:
                stmt = stmt.on_conflict_do_update(index_elements=target, set_=updates)
            else:
                stmt = stmt.on_conflict_do_nothing(index_elements=target)
            await self.session.execute(stmt)
        return len(rows)


__all__ = ["SqlRepository"]
