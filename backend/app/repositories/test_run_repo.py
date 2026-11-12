"""``test_runs`` table access (write side; read methods arrive in B6.1)."""

from __future__ import annotations

from app.models.test_run import TestRun
from app.repositories.base import SqlRepository


class PgTestRunRepository(SqlRepository[TestRun]):
    model = TestRun
    conflict_cols = ("experiment_id",)


__all__ = ["PgTestRunRepository"]
