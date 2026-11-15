from __future__ import annotations

import sys
from collections.abc import Coroutine, Iterator
from pathlib import Path
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.api.deps import get_live_telemetry_service  # noqa: E402
from app.api.routers.live_telemetry import (  # noqa: E402
    get_live_telemetry,
    ingest_live_telemetry,
    reset_live_telemetry,
)
from app.core.config import get_settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.repositories.snapshot.repos import SnapshotTestRunRepo  # noqa: E402
from app.repositories.snapshot.store import get_snapshot_store  # noqa: E402
from app.schemas.cabin import CabinConfig  # noqa: E402
from app.schemas.enums import DiluentGas, FuelMaterial, LiveStreamStatus  # noqa: E402
from app.schemas.live_telemetry import LiveSensorReadings, LiveTelemetryIngestRequest  # noqa: E402
from app.services.live_telemetry_service import (  # noqa: E402
    ACTIVE_TTL_SECONDS,
    MAX_HISTORY,
    LiveTelemetryService,
    reset_live_telemetry_buffer,
)


def _run[T](coro: Coroutine[Any, Any, T]) -> T:
    """Step an async coroutine without creating a Windows Proactor socketpair."""
    while True:
        try:
            coro.send(None)
        except StopIteration as exc:
            return exc.value


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[None]:
    reset_live_telemetry_buffer()
    monkeypatch.setenv("DB_USER", "ember")
    monkeypatch.setenv("DB_PASSWORD", "ember")
    monkeypatch.setenv("DB_NAME", "ember")
    monkeypatch.setenv("DATA_BACKEND", "snapshot")
    monkeypatch.setenv("EMBED_ENABLED", "false")
    monkeypatch.setenv("SEED_DIR", str(BACKEND_DIR / "tests" / "fixtures" / "proxy"))
    monkeypatch.setenv("SNAPSHOT_PATH", str(tmp_path / "store.json"))
    monkeypatch.setenv("CACHE_DIR", str(tmp_path / "cache"))
    monkeypatch.setenv("LLM_PROVIDER", "heuristic")
    get_settings.cache_clear()
    get_snapshot_store.cache_clear()
    yield
    reset_live_telemetry_buffer()
    get_snapshot_store.cache_clear()
    get_settings.cache_clear()


def test_live_telemetry_service_ingest_and_reset() -> None:
    repo = SnapshotTestRunRepo(get_snapshot_store())
    service = LiveTelemetryService(repo)

    initial = _run(service.get_state())
    assert initial.active is False
    assert initial.status == LiveStreamStatus.IDLE
    assert initial.sample_count == 0
    assert initial.latest is None
    assert initial.history == []
    assert initial.top_matches == []

    req = LiveTelemetryIngestRequest(
        session_id="sim-test-1",
        experiment_name="SoFIE Oxygen Ramp",
        phase="Ignition & Spread",
        event="Chamber ignited at 29% O2",
        status=LiveStreamStatus.STREAMING,
        timestamp_s=12.5,
        config=CabinConfig(
            oxygen_pct=29.0,
            pressure_kpa=70.3,
            flow_velocity_cm_s=12.0,
            gravity_g=0.0,
            fuel_material=FuelMaterial.PMMA,
            diluent_gas=DiluentGas.N2,
        ),
        raw_sensors=LiveSensorReadings(
            oxygen_pct_raw=29.18,
            pressure_kpa_raw=70.12,
            flow_velocity_cm_s_raw=12.4,
            gravity_g_raw=0.002,
            flame_temp_k=1740.0,
            radiative_heat_flux_kw_m2=6.4,
            flame_radius_mm=18.2,
        ),
    )
    state = _run(service.ingest(req))

    assert state.active is True
    assert state.status == LiveStreamStatus.STREAMING
    assert state.session_id == "sim-test-1"
    assert state.experiment_name == "SoFIE Oxygen Ramp"
    assert state.sample_count == 1
    assert len(state.history) == 1
    assert state.latest is not None
    assert state.latest.seq == 1
    assert state.latest.timestamp_s == 12.5
    assert state.latest.event == "Chamber ignited at 29% O2"

    # Shapley sum check: sum(contributions) == risk_index - baseline_risk (within rounding tolerance)
    ev = state.latest.evaluation
    contrib_sum = sum(c.value for c in ev.contributions)
    assert abs(contrib_sum - (ev.risk_index - ev.baseline_risk)) <= 0.05

    # Top matches ranked for the live chamber configuration
    assert len(state.top_matches) == 5
    assert state.top_matches[0].rank == 1

    # Reset clears state back to idle
    cleared = _run(service.reset())
    assert cleared.active is False
    assert cleared.status == LiveStreamStatus.IDLE
    assert cleared.sample_count == 0
    assert cleared.latest is None
    assert cleared.history == []


def test_live_telemetry_router_functions_and_history_cap() -> None:
    repo = SnapshotTestRunRepo(get_snapshot_store())
    service = LiveTelemetryService(repo)

    req = LiveTelemetryIngestRequest(
        session_id="router-test",
        experiment_name="Artemis Pre-Breathe",
        phase="Exploration Hold",
        status=LiveStreamStatus.STREAMING,
        timestamp_s=5.0,
        config=CabinConfig(
            oxygen_pct=34.0,
            pressure_kpa=56.5,
            flow_velocity_cm_s=10.0,
            gravity_g=0.0,
            fuel_material=FuelMaterial.COTTON_FIBERGLASS,
            diluent_gas=DiluentGas.N2,
        ),
        raw_sensors=LiveSensorReadings(
            oxygen_pct_raw=34.12,
            pressure_kpa_raw=56.6,
            flame_temp_k=1820.5,
        ),
    )
    s1 = _run(ingest_live_telemetry(req, service))
    assert s1.active is True
    assert s1.sample_count == 1
    assert s1.latest is not None
    assert s1.latest.evaluation.risk_band in {"LOW", "ELEVATED", "HIGH", "CRITICAL"}
    assert len(s1.top_matches) == 5

    # Push beyond MAX_HISTORY to confirm rolling cap
    for step in range(MAX_HISTORY + 5):
        _run(
            ingest_live_telemetry(
                LiveTelemetryIngestRequest(
                    timestamp_s=float(step + 6),
                    config=req.config,
                ),
                service,
            )
        )
    s_capped = _run(get_live_telemetry(service))
    assert s_capped.sample_count == MAX_HISTORY + 6
    assert len(s_capped.history) == MAX_HISTORY

    s2 = _run(reset_live_telemetry(service))
    assert s2.sample_count == 0
    assert s2.status == LiveStreamStatus.IDLE


async def test_stream_becomes_stale_without_discarding_history(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import live_telemetry_service

    clock = [100.0]
    monkeypatch.setattr(live_telemetry_service.time, "monotonic", lambda: clock[0])
    service = LiveTelemetryService(SnapshotTestRunRepo(get_snapshot_store()))
    req = LiveTelemetryIngestRequest(
        config=CabinConfig(
            oxygen_pct=21,
            pressure_kpa=101.3,
            flow_velocity_cm_s=10,
            gravity_g=0,
            fuel_material=FuelMaterial.PMMA,
            diluent_gas=DiluentGas.N2,
        ),
    )
    first = await service.ingest(req)
    assert first.active
    clock[0] += ACTIVE_TTL_SECONDS + 1
    stale = await service.get_state()
    assert not stale.active
    assert stale.status == LiveStreamStatus.STREAMING
    assert stale.history == first.history
    resumed = await service.ingest(req)
    assert resumed.active
    assert resumed.sample_count == 2


async def test_http_ingest_validation_and_reset() -> None:
    service = LiveTelemetryService(SnapshotTestRunRepo(get_snapshot_store()))
    app = create_app()
    app.dependency_overrides[get_live_telemetry_service] = lambda: service
    payload = {
        "session_id": "http-test",
        "config": {
            "oxygen_pct": 29,
            "pressure_kpa": 70.3,
            "flow_velocity_cm_s": 12,
            "gravity_g": 0,
            "fuel_material": "PMMA",
            "diluent_gas": "N2",
        },
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        empty = await client.get("/api/live-telemetry")
        assert empty.status_code == 200
        assert empty.json()["sample_count"] == 0

        ingested = await client.post("/api/live-telemetry", json=payload)
        assert ingested.status_code == 200
        state = ingested.json()
        assert state["latest"]["raw_sensors"] is None

        evaluated = await client.post("/api/evaluate-cabin", json=payload["config"])
        assert evaluated.status_code == 200
        assert state["latest"]["evaluation"] == evaluated.json()

        polled = await client.get("/api/live-telemetry")
        assert polled.json()["latest"] == state["latest"]

        for invalid in (
            {},
            {**payload, "status": "invalid"},
            {**payload, "timestamp_s": -1},
            {**payload, "timestamp_s": "Infinity"},
            {**payload, "raw_sensors": {"flame_temp_k": -5}},
            {**payload, "raw_sensors": {"oxygen_pct_raw": "NaN"}},
        ):
            response = await client.post("/api/live-telemetry", json=invalid)
            assert response.status_code == 422, response.text
            assert response.json()["error"]["code"] == "VALIDATION_ERROR"

        after_invalid = await client.get("/api/live-telemetry")
        assert after_invalid.json()["sample_count"] == 1

        restarted = await client.post("/api/live-telemetry", json={**payload, "reset": True})
        assert restarted.json()["sample_count"] == 1
        assert len(restarted.json()["history"]) == 1

        reset = await client.post("/api/live-telemetry/reset")
        assert reset.status_code == 200
        assert reset.json()["status"] == "idle"
        assert reset.json()["history"] == []
