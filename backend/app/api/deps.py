"""FastAPI dependency wiring: sessions, DB availability, and Protocol-typed readers.

Every reader factory asks the cached ``DbAvailability`` (plan.md D3) and returns the Postgres implementation
on a read-only session when the DB is up, otherwise the snapshot implementation. The decision is cached for
``DB_PROBE_TTL_S``, so with Postgres down only the first request pays the probe timeout. Opening an
``AsyncSession`` is lazy (no connection until the first query), so snapshot requests never touch the DB.
"""

from __future__ import annotations

from typing import Annotated

import anyio.to_thread
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.availability import DbAvailability
from app.db.engine import Database
from app.db.session import get_db, get_readonly_session, get_session
from app.embeddings.factory import get_embedder
from app.llm.factory import get_llm_provider
from app.rag.toolkit import RagToolkit
from app.repositories.chunk_repo import PgChunkRepository
from app.repositories.interfaces import (
    ChunkSearcher,
    PresetReader,
    StatsReader,
    TelemetryReader,
    TestRunReader,
)
from app.repositories.pg import PgRepos
from app.repositories.preset_repo import PgPresetRepository
from app.repositories.snapshot.repos import (
    SnapshotChunkRepo,
    SnapshotPresetRepo,
    SnapshotStats,
    SnapshotTelemetryRepo,
    SnapshotTestRunRepo,
)
from app.repositories.snapshot.store import SnapshotStore, get_snapshot_store
from app.repositories.telemetry_repo import PgTelemetryRepository
from app.repositories.test_run_repo import PgTestRunRepository
from app.services.cabin_service import CabinService
from app.services.copilot_service import CopilotService
from app.services.experiment_service import ExperimentService
from app.services.health_service import HealthService
from app.services.preset_service import PresetService
from app.services.ranking_service import RankingService
from app.services.telemetry_service import TelemetryService

SessionDep = Annotated[AsyncSession, Depends(get_session)]
ROSessionDep = Annotated[AsyncSession, Depends(get_readonly_session)]


def get_availability(db: Annotated[Database, Depends(get_db)]) -> DbAvailability:
    return db.availability


AvailabilityDep = Annotated[DbAvailability, Depends(get_availability)]


async def _snapshot() -> SnapshotStore:
    # First call reads (or builds) the snapshot: do it off the event loop.
    return await anyio.to_thread.run_sync(get_snapshot_store)


async def get_stats_reader(availability: AvailabilityDep, session: ROSessionDep) -> StatsReader:
    if await availability.is_up():
        return PgRepos(session).stats
    return SnapshotStats(await _snapshot())


async def get_preset_reader(availability: AvailabilityDep, session: ROSessionDep) -> PresetReader:
    if await availability.is_up():
        return PgPresetRepository(session)
    return SnapshotPresetRepo(await _snapshot())


async def get_test_run_reader(availability: AvailabilityDep, session: ROSessionDep) -> TestRunReader:
    if await availability.is_up():
        return PgTestRunRepository(session)
    return SnapshotTestRunRepo(await _snapshot())


async def get_telemetry_reader(availability: AvailabilityDep, session: ROSessionDep) -> TelemetryReader:
    if await availability.is_up():
        return PgTelemetryRepository(session)
    return SnapshotTelemetryRepo(await _snapshot())


async def get_chunk_searcher(availability: AvailabilityDep, session: ROSessionDep) -> ChunkSearcher:
    if await availability.is_up():
        return PgChunkRepository(session)
    return SnapshotChunkRepo(await _snapshot())


StatsReaderDep = Annotated[StatsReader, Depends(get_stats_reader)]
PresetReaderDep = Annotated[PresetReader, Depends(get_preset_reader)]
TestRunReaderDep = Annotated[TestRunReader, Depends(get_test_run_reader)]
TelemetryReaderDep = Annotated[TelemetryReader, Depends(get_telemetry_reader)]
ChunkSearcherDep = Annotated[ChunkSearcher, Depends(get_chunk_searcher)]


async def get_health_service(availability: AvailabilityDep, stats: StatsReaderDep) -> HealthService:
    return HealthService(
        stats=stats,
        db_up=await availability.is_up(),
        llm_name=get_llm_provider().name,
    )


HealthServiceDep = Annotated[HealthService, Depends(get_health_service)]


def get_preset_service(reader: PresetReaderDep) -> PresetService:
    return PresetService(reader)


PresetServiceDep = Annotated[PresetService, Depends(get_preset_service)]


def get_cabin_service() -> CabinService:
    return CabinService()


CabinServiceDep = Annotated[CabinService, Depends(get_cabin_service)]


def get_experiment_service(reader: TestRunReaderDep) -> ExperimentService:
    return ExperimentService(reader)


ExperimentServiceDep = Annotated[ExperimentService, Depends(get_experiment_service)]


def get_ranking_service(reader: TestRunReaderDep) -> RankingService:
    return RankingService(reader)


RankingServiceDep = Annotated[RankingService, Depends(get_ranking_service)]


def get_telemetry_service(reader: TelemetryReaderDep) -> TelemetryService:
    return TelemetryService(reader)


TelemetryServiceDep = Annotated[TelemetryService, Depends(get_telemetry_service)]


def get_rag_toolkit(runs: TestRunReaderDep, chunks: ChunkSearcherDep) -> RagToolkit:
    return RagToolkit(
        runs=runs,
        chunks=chunks,
        embedder=get_embedder(),
        llm=get_llm_provider(),
        settings=get_settings(),
    )


RagToolkitDep = Annotated[RagToolkit, Depends(get_rag_toolkit)]


def get_copilot_service(tk: RagToolkitDep) -> CopilotService:
    return CopilotService(tk)


CopilotServiceDep = Annotated[CopilotService, Depends(get_copilot_service)]

__all__ = [
    "AvailabilityDep",
    "CabinServiceDep",
    "CopilotServiceDep",
    "ChunkSearcherDep",
    "ExperimentServiceDep",
    "HealthServiceDep",
    "PresetReaderDep",
    "PresetServiceDep",
    "ROSessionDep",
    "RagToolkitDep",
    "RankingServiceDep",
    "SessionDep",
    "StatsReaderDep",
    "TelemetryReaderDep",
    "TelemetryServiceDep",
    "TestRunReaderDep",
    "get_availability",
    "get_cabin_service",
    "get_chunk_searcher",
    "get_experiment_service",
    "get_health_service",
    "get_preset_reader",
    "get_preset_service",
    "get_ranking_service",
    "get_stats_reader",
    "get_telemetry_reader",
    "get_telemetry_service",
    "get_test_run_reader",
]
