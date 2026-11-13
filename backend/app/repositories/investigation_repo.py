"""``investigations`` table access (write side; read methods arrive in B6.1)."""

from __future__ import annotations

from app.models.investigation import Investigation
from app.repositories.base import SqlRepository


class PgInvestigationRepository(SqlRepository[Investigation]):
    model = Investigation
    conflict_cols = ("id",)


__all__ = ["PgInvestigationRepository"]
