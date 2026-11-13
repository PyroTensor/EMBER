"""All Postgres repositories bound to one ``AsyncSession``."""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.chunk_repo import PgChunkRepository
from app.repositories.document_repo import PgDocumentRepository
from app.repositories.investigation_repo import PgInvestigationRepository
from app.repositories.preset_repo import PgPresetRepository
from app.repositories.telemetry_repo import PgTelemetryRepository
from app.repositories.test_run_repo import PgTestRunRepository


@dataclass(frozen=True)
class PgStats:
    """``StatsReader`` over the test-run and chunk repositories."""

    test_runs: PgTestRunRepository
    chunks: PgChunkRepository

    async def count_runs(self) -> int:
        return await self.test_runs.count()

    async def count_chunks(self) -> int:
        return await self.chunks.count()

    async def extra_telemetry_keys(self) -> list[str]:
        return await self.test_runs.extra_telemetry_keys()


@dataclass
class PgRepos:
    """``PgRepos(session)`` builds every repository on that session (one unit of work)."""

    session: AsyncSession
    test_runs: PgTestRunRepository = field(init=False)
    telemetry: PgTelemetryRepository = field(init=False)
    presets: PgPresetRepository = field(init=False)
    chunks: PgChunkRepository = field(init=False)
    investigations: PgInvestigationRepository = field(init=False)
    documents: PgDocumentRepository = field(init=False)
    stats: PgStats = field(init=False)

    def __post_init__(self) -> None:
        s = self.session
        self.test_runs = PgTestRunRepository(s)
        self.telemetry = PgTelemetryRepository(s)
        self.presets = PgPresetRepository(s)
        self.chunks = PgChunkRepository(s)
        self.investigations = PgInvestigationRepository(s)
        self.documents = PgDocumentRepository(s)
        self.stats = PgStats(self.test_runs, self.chunks)


__all__ = ["PgRepos", "PgStats"]
