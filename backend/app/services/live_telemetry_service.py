"""Live telemetry buffer and evaluation service for real-time lab / simulator streams."""

from __future__ import annotations

import time
from collections import deque
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Final

from app.core.constants import DEFAULT_RANK_WEIGHTS
from app.domain.ranking.scenario_ranker import rank_runs
from app.domain.risk.fire_risk import evaluate_cabin
from app.domain.types import ISS_BASELINE
from app.repositories.interfaces import TestRunReader
from app.schemas.enums import LiveStreamStatus
from app.schemas.live_telemetry import (
    LiveTelemetryIngestRequest,
    LiveTelemetrySample,
    LiveTelemetryState,
)
from app.schemas.ranking import RankedExperiment
from app.services.cabin_service import cabin_to_params, evaluation_to_schema
from app.services.ranking_service import ranked_run_to_schema

MAX_HISTORY: Final = 120
TOP_MATCH_LIMIT: Final = 5
ACTIVE_TTL_SECONDS: Final = 30.0


@dataclass
class _LiveTelemetryBuffer:
    status: LiveStreamStatus = LiveStreamStatus.IDLE
    session_id: str | None = None
    experiment_name: str | None = None
    updated_at: str | None = None
    seq: int = 0
    started_monotonic: float | None = None
    last_frame_monotonic: float | None = None
    history: deque[LiveTelemetrySample] = field(default_factory=lambda: deque(maxlen=MAX_HISTORY))
    top_matches: list[RankedExperiment] = field(default_factory=list)

    def clear(self) -> None:
        self.status = LiveStreamStatus.IDLE
        self.session_id = None
        self.experiment_name = None
        self.updated_at = None
        self.seq = 0
        self.started_monotonic = None
        self.last_frame_monotonic = None
        self.history.clear()
        self.top_matches = []

    def is_active(self, now_mono: float) -> bool:
        if self.status != LiveStreamStatus.STREAMING or self.last_frame_monotonic is None:
            return False
        return (now_mono - self.last_frame_monotonic) <= ACTIVE_TTL_SECONDS

    def to_state(self, now_mono: float | None = None) -> LiveTelemetryState:
        mono = time.monotonic() if now_mono is None else now_mono
        samples = list(self.history)
        return LiveTelemetryState(
            active=self.is_active(mono),
            status=self.status,
            session_id=self.session_id,
            experiment_name=self.experiment_name,
            updated_at=self.updated_at,
            sample_count=self.seq,
            latest=samples[-1] if samples else None,
            history=samples,
            top_matches=list(self.top_matches),
        )


_BUFFER = _LiveTelemetryBuffer()


def reset_live_telemetry_buffer() -> None:
    """Clear the module-level live telemetry buffer (useful for tests)."""
    _BUFFER.clear()


class LiveTelemetryService:
    """Ingests live chamber telemetry frames, computes risk/Shapley & top matches, and serves state."""

    def __init__(self, reader: TestRunReader) -> None:
        self._reader = reader

    async def get_state(self) -> LiveTelemetryState:
        return _BUFFER.to_state()

    async def ingest(self, req: LiveTelemetryIngestRequest) -> LiveTelemetryState:
        params = cabin_to_params(req.config)
        evaluation = evaluation_to_schema(evaluate_cabin(params, ISS_BASELINE))
        runs = await self._reader.all_for_ranking()
        ranked = rank_runs(list(runs), asdict(params), DEFAULT_RANK_WEIGHTS, TOP_MATCH_LIMIT)
        top_matches = [ranked_run_to_schema(r) for r in ranked]

        now_mono = time.monotonic()
        now_iso = datetime.now(UTC).isoformat(timespec="seconds")

        if req.reset:
            _BUFFER.clear()

        if _BUFFER.started_monotonic is None:
            _BUFFER.started_monotonic = now_mono

        _BUFFER.seq += 1
        timestamp_s = (
            round(req.timestamp_s, 3)
            if req.timestamp_s is not None
            else round(now_mono - _BUFFER.started_monotonic, 3)
        )

        if req.session_id is not None:
            _BUFFER.session_id = req.session_id
        if req.experiment_name is not None:
            _BUFFER.experiment_name = req.experiment_name
        _BUFFER.status = req.status or LiveStreamStatus.STREAMING
        _BUFFER.updated_at = now_iso
        _BUFFER.last_frame_monotonic = now_mono
        _BUFFER.top_matches = top_matches

        sample = LiveTelemetrySample(
            seq=_BUFFER.seq,
            timestamp_s=timestamp_s,
            recorded_at=now_iso,
            phase=req.phase,
            event=req.event,
            config=req.config,
            raw_sensors=req.raw_sensors,
            evaluation=evaluation,
        )
        _BUFFER.history.append(sample)
        return _BUFFER.to_state(now_mono)

    async def reset(self) -> LiveTelemetryState:
        _BUFFER.clear()
        return _BUFFER.to_state()


__all__ = ["ACTIVE_TTL_SECONDS", "LiveTelemetryService", "MAX_HISTORY", "reset_live_telemetry_buffer"]
