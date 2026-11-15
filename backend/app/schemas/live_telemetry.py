"""``GET / POST /api/live-telemetry``: live lab/chamber telemetry ingestion and dashboard state."""

from __future__ import annotations

from pydantic import Field, FiniteFloat

from app.schemas.cabin import CabinConfig, CabinEvaluation
from app.schemas.common import APIModel
from app.schemas.enums import LiveStreamStatus
from app.schemas.ranking import RankedExperiment


class LiveSensorReadings(APIModel):
    """Raw unsmoothed cabin transducers plus live combustion rig diagnostics."""

    oxygen_pct_raw: FiniteFloat | None = None
    pressure_kpa_raw: FiniteFloat | None = None
    flow_velocity_cm_s_raw: FiniteFloat | None = None
    gravity_g_raw: FiniteFloat | None = None
    flame_temp_k: FiniteFloat | None = Field(default=None, ge=0.0)
    radiative_heat_flux_kw_m2: FiniteFloat | None = Field(default=None, ge=0.0)
    flame_radius_mm: FiniteFloat | None = Field(default=None, ge=0.0)


class LiveTelemetryIngestRequest(APIModel):
    """One live telemetry frame pushed from an external lab DAQ or simulator."""

    session_id: str | None = Field(default=None, max_length=120)
    experiment_name: str | None = Field(default=None, max_length=200)
    phase: str | None = Field(default=None, max_length=120)
    event: str | None = Field(default=None, max_length=300)
    status: LiveStreamStatus | None = None
    timestamp_s: FiniteFloat | None = Field(default=None, ge=0.0)
    config: CabinConfig
    raw_sensors: LiveSensorReadings | None = None
    reset: bool | None = None


class LiveTelemetrySample(APIModel):
    """Evaluated telemetry frame stored in the rolling stream buffer."""

    seq: int = Field(ge=1)
    timestamp_s: float
    recorded_at: str
    phase: str | None = None
    event: str | None = None
    config: CabinConfig
    raw_sensors: LiveSensorReadings | None = None
    evaluation: CabinEvaluation


class LiveTelemetryState(APIModel):
    """Current live stream status, rolling sample history, and top matching NASA test runs."""

    active: bool
    status: LiveStreamStatus
    session_id: str | None = None
    experiment_name: str | None = None
    updated_at: str | None = None
    sample_count: int = Field(ge=0)
    latest: LiveTelemetrySample | None = None
    history: list[LiveTelemetrySample]
    top_matches: list[RankedExperiment]


__all__ = [
    "LiveSensorReadings",
    "LiveTelemetryIngestRequest",
    "LiveTelemetrySample",
    "LiveTelemetryState",
]
