"""I10: migration 0005 (combustion_findings) against a real Postgres - ``make test-int``.

Creates a throw-away database on the configured server (``DB_*`` settings), runs ``alembic upgrade head``
there through ``config.attributes["url"]`` (see alembic/env.py), checks the table, the CHECK constraint and
that the read-only role can SELECT it, downgrades to 0004, and drops the database. Skipped when Postgres is
not reachable.
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from alembic.config import Config  # noqa: E402

from alembic import command  # noqa: E402

pytestmark = pytest.mark.integration

asyncpg: Any = pytest.importorskip("asyncpg")


def _settings() -> Any:
    from app.core.config import get_settings

    get_settings.cache_clear()
    return get_settings()


def _dsn(user: str, password: str, database: str) -> str:
    s = _settings()
    return f"postgresql://{user}:{password}@{s.DB_HOST}:{s.DB_PORT}/{database}"


async def _execute(dsn: str, *sql: str) -> list[Any]:
    conn = await asyncpg.connect(dsn, timeout=5)
    try:
        out = []
        for stmt in sql:
            out.append(await conn.fetch(stmt))
        return out
    finally:
        await conn.close()


@pytest.fixture(scope="module")
def scratch_db() -> Iterator[str]:
    s = _settings()
    admin = _dsn(s.DB_USER, s.DB_PASSWORD.get_secret_value(), s.DB_NAME)
    name = f"ember_mig_{uuid.uuid4().hex[:8]}"
    try:
        asyncio.run(_execute(admin, f'CREATE DATABASE "{name}"'))
    except (OSError, asyncpg.PostgresError) as exc:
        pytest.skip(f"Postgres not reachable for migration test: {exc}")
    try:
        yield name
    finally:
        asyncio.run(_execute(admin, f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))


def _alembic(database: str) -> Config:
    s = _settings()
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.attributes["url"] = (
        f"postgresql+asyncpg://{s.DB_USER}:{s.DB_PASSWORD.get_secret_value()}@{s.DB_HOST}:{s.DB_PORT}/{database}"
    )
    return cfg


def test_0005_upgrade_check_readonly_and_downgrade(scratch_db: str) -> None:
    s = _settings()
    owner = _dsn(s.DB_USER, s.DB_PASSWORD.get_secret_value(), scratch_db)
    cfg = _alembic(scratch_db)

    command.upgrade(cfg, "head")
    (version,), (cols,), (indexes,) = asyncio.run(
        _execute(
            owner,
            "SELECT version_num FROM alembic_version",
            "SELECT count(*) FROM information_schema.columns WHERE table_name = 'combustion_findings'",
            "SELECT array_agg(indexname ORDER BY indexname) FROM pg_indexes "
            "WHERE tablename = 'combustion_findings'",
        )
    )
    assert version["version_num"] == "0005"
    assert cols["count"] == 23
    assert set(indexes["array_agg"]) >= {
        "pk_combustion_findings",
        "ix_combustion_findings_category",
        "ix_combustion_findings_source_doc_id",
        "ix_combustion_findings_conditions",
    }

    # CHECK: a finding needs doc+page OR file+row
    ok = (
        "INSERT INTO combustion_findings (finding_id, category, gravity_context, statement, origin, "
        "source_file, source_row, confidence, relevance) "
        "VALUES ('f-ok', 'other', 'microgravity', 's', 'csv_reject', 'runs.csv', 3, 1, 1)"
    )
    asyncio.run(_execute(owner, ok))
    bad = (
        "INSERT INTO combustion_findings (finding_id, category, gravity_context, statement, origin, "
        "confidence, relevance) VALUES ('f-bad', 'other', 'microgravity', 's', 'llm', 1, 1)"
    )
    with pytest.raises(asyncpg.CheckViolationError):
        asyncio.run(_execute(owner, bad))

    # read-only role (0004 default privileges) can SELECT the new table
    readonly = _dsn(s.DB_RO_USER, s.DB_RO_PASSWORD.get_secret_value(), scratch_db)
    ((row,),) = asyncio.run(_execute(readonly, "SELECT count(*) FROM combustion_findings"))
    assert row["count"] == 1

    command.downgrade(cfg, "0004")
    ((exists,),) = asyncio.run(_execute(owner, "SELECT to_regclass('combustion_findings') IS NULL AS gone"))
    assert exists["gone"] is True
