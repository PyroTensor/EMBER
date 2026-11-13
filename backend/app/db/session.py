"""FastAPI dependencies for the Database and per-request sessions."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import cast

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.engine import Database


def get_db(request: Request) -> Database:
    return cast(Database, request.app.state.db)


async def get_session(db: Database = Depends(get_db)) -> AsyncIterator[AsyncSession]:  # noqa: B008
    """Read-write session: commit on success, roll back on error."""
    async with db.rw_sessionmaker() as session:
        try:
            yield session
            await session.commit()
        except BaseException:
            await session.rollback()
            raise


async def get_readonly_session(db: Database = Depends(get_db)) -> AsyncIterator[AsyncSession]:  # noqa: B008
    """Read-only role session; never commits (closing the session rolls back)."""
    async with db.ro_sessionmaker() as session:
        yield session


__all__ = ["get_db", "get_readonly_session", "get_session"]
