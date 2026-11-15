#!/usr/bin/env python3
"""Standalone NASA microgravity combustion & cabin live-telemetry simulator.

This file intentionally lives at the repository root (outside ``backend/`` and ``frontend/``)
and is excluded by ``.dockerignore``, so it stays out of all Docker images while feeding live
sensor frames into EMBER's Live Telemetry dashboard (``/live-telemetry``).

Usage:
    python3 simulate_live_telemetry.py
    python3 simulate_live_telemetry.py --scenario ventilation-paradox --interval 0.8
    python3 simulate_live_telemetry.py --scenario cool-flame-drop --steps 45
    python3 simulate_live_telemetry.py --url http://localhost:8000 --loop

Requires only the Python 3 standard library.
If the EMBER backend is running at ``--url``, frames are streamed via ``POST /api/live-telemetry``.
If nothing is listening at ``--url``, this script automatically starts a lightweight local HTTP
server on that port serving ``/api/health``, ``/api/live-telemetry``, and
``/api/live-telemetry/reset`` with exact EMBER fire-risk & Shapley calculations.
"""

from __future__ import annotations

import argparse
import copy
import csv
import itertools
import json
import math
import random
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from dataclasses import dataclass
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Pure Python port of EMBER combustion physics, risk index, Shapley & ranker
# (used by the embedded fallback server when the FastAPI backend is offline).
# ---------------------------------------------------------------------------

P0_KPA = 101.3
DEFAULT_BASE_LOI = 18.0
MATERIAL_BASE_LOI: dict[str, float] = {
    "PMMA": 17.5,
    "Cotton-Fiberglass": 18.5,
    "Nomex": 27.0,
    "Heptane": 13.5,
    "Methanol": 15.5,
}
FUEL_MATERIALS: tuple[str, ...] = (
    "PMMA",
    "Cotton-Fiberglass",
    "Nomex",
    "Heptane",
    "Methanol",
    "Ethylene",
    "Ethane",
    "Propane",
    "Butane",
)
DILUENT_SHIFT: dict[str, float] = {"N2": 0.0, "CO2": 3.0, "He": 2.0, "Ar": -1.0}
ISS_BASELINE: dict[str, Any] = {
    "oxygen_pct": 21.0,
    "pressure_kpa": 101.3,
    "flow_velocity_cm_s": 10.0,
    "gravity_g": 0.0,
    "fuel_material": "Cotton-Fiberglass",
    "diluent_gas": "N2",
}
FEATURE_GROUPS: dict[str, tuple[str, tuple[str, ...]]] = {
    "oxygen_enrichment": ("Oxygen concentration", ("oxygen_pct",)),
    "ventilation_coupling": ("HVAC ventilation flow", ("flow_velocity_cm_s",)),
    "gravity_buoyancy_regime": ("Gravity / buoyancy", ("gravity_g",)),
    "cabin_pressure_density": ("Cabin pressure", ("pressure_kpa",)),
    "material_flammability_intrinsic": ("Material & diluent", ("fuel_material", "diluent_gas")),
}
SIM_FEATURES: dict[str, tuple[float, float]] = {
    "oxygen_pct": (25.0, 1.0),
    "pressure_kpa": (61.3, 0.7),
    "flow_velocity_cm_s": (50.0, 0.7),
    "gravity_g": (1.0, 1.0),
}
REGIME_SEVERITY: dict[str, float] = {
    "Sustained Burn": 1.0,
    "Cool Flame": 0.85,
    "Self-Extinguished": 0.4,
    "No Ignition": 0.1,
}
OPTIONAL_OUTPUTS = (
    "spread_or_burn_rate",
    "peak_radiative_flux_kw_m2",
    "limiting_oxygen_index_pct",
    "burn_duration_s",
)


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _buoyant_velocity(gravity_g: float, pressure_kpa: float) -> float:
    return 30.0 * math.sqrt(max(gravity_g, 0.0) * max(pressure_kpa, 0.0) / P0_KPA)


def _effective_velocity(flow_cm_s: float, gravity_g: float, pressure_kpa: float) -> float:
    return math.sqrt(flow_cm_s**2 + _buoyant_velocity(gravity_g, pressure_kpa) ** 2)


def _flow_loi_shift(u_eff: float) -> float:
    return (
        3.0 * math.exp(-u_eff / 3.0)
        - 1.5 * math.exp(-(((u_eff - 8.0) / 6.0) ** 2))
        + 0.05 * max(0.0, u_eff - 30.0)
    )


def _pressure_loi_shift(pressure_kpa: float) -> float:
    return 4.0 * (1.0 - pressure_kpa / P0_KPA)


def limiting_oxygen_index(cfg: dict[str, Any]) -> float:
    u = _effective_velocity(
        float(cfg["flow_velocity_cm_s"]),
        float(cfg["gravity_g"]),
        float(cfg["pressure_kpa"]),
    )
    base_loi = MATERIAL_BASE_LOI.get(str(cfg["fuel_material"]), DEFAULT_BASE_LOI)
    dil_shift = DILUENT_SHIFT.get(str(cfg["diluent_gas"]), 0.0)
    return base_loi + _flow_loi_shift(u) + _pressure_loi_shift(float(cfg["pressure_kpa"])) + dil_shift


def predict_regime(material: str, gravity_g: float, oxygen_margin: float) -> str:
    if oxygen_margin < -2.0:
        return "No Ignition"
    if oxygen_margin < 0.0:
        return "Self-Extinguished"
    if material == "Heptane" and gravity_g < 0.05 and oxygen_margin < 9.0:
        return "Cool Flame"
    return "Sustained Burn"


def _risk_value(cfg: dict[str, Any]) -> float:
    margin = float(cfg["oxygen_pct"]) - limiting_oxygen_index(cfg)
    z = max(min((margin - 4.0) / 3.0, 60.0), -60.0)
    return 100.0 / (1.0 + math.exp(-z))


def _risk_band(r: float) -> str:
    if r < 25:
        return "LOW"
    if r < 50:
        return "ELEVATED"
    if r < 75:
        return "HIGH"
    return "CRITICAL"


def evaluate_cabin_local(cfg: dict[str, Any]) -> dict[str, Any]:
    loi = limiting_oxygen_index(cfg)
    margin = float(cfg["oxygen_pct"]) - loi
    r = _risk_value(cfg)
    base_r = _risk_value(ISS_BASELINE)
    r_rounded = round(r, 2)
    base_rounded = round(base_r, 2)

    names = list(FEATURE_GROUPS.keys())
    cache: dict[frozenset[str], float] = {}

    def v(subset: frozenset[str]) -> float:
        if subset not in cache:
            mixed = dict(ISS_BASELINE)
            for grp in subset:
                for field_name in FEATURE_GROUPS[grp][1]:
                    mixed[field_name] = cfg[field_name]
            cache[subset] = _risk_value(mixed)
        return cache[subset]

    phi = {name: 0.0 for name in names}
    n = len(names)
    for name in names:
        others = [k for k in names if k != name]
        for size in range(n):
            weight = math.factorial(size) * math.factorial(n - size - 1) / math.factorial(n)
            for combo in itertools.combinations(others, size):
                s = frozenset(combo)
                phi[name] += weight * (v(s | {name}) - v(s))

    contribs = sorted(
        (
            {
                "feature": k,
                "label": FEATURE_GROUPS[k][0],
                "value": round(val, 2),
            }
            for k, val in phi.items()
        ),
        key=lambda item: abs(item["value"]),
        reverse=True,
    )
    if contribs and abs(contribs[0]["value"]) > 0:
        target_delta = round(r_rounded - base_rounded, 2)
        current_sum = round(sum(c["value"] for c in contribs), 2)
        residual = round(target_delta - current_sum, 2)
        if residual != 0.0:
            contribs[0]["value"] = round(contribs[0]["value"] + residual, 2)

    return {
        "risk_index": r_rounded,
        "risk_band": _risk_band(r),
        "baseline_risk": base_rounded,
        "predicted_regime": predict_regime(str(cfg["fuel_material"]), float(cfg["gravity_g"]), margin),
        "estimated_loi_pct": round(loi, 2),
        "oxygen_margin_pct": round(margin, 2),
        "contributions": contribs,
    }


def _load_runs_for_local_ranker() -> list[dict[str, Any]]:
    root = Path(__file__).resolve().parent
    parity_path = root / "contracts" / "fixtures" / "domain_parity.json"
    if parity_path.exists():
        try:
            data = json.loads(parity_path.read_text(encoding="utf-8"))
            runs = data.get("runs", [])
            if isinstance(runs, list) and runs:
                return runs
        except Exception:
            pass
    csv_path = root / "backend" / "tests" / "fixtures" / "proxy" / "experiments_proxy.csv"
    if csv_path.exists():
        try:
            with csv_path.open(encoding="utf-8", newline="") as f:
                return list(csv.DictReader(f))
        except Exception:
            pass
    return []


def rank_runs_local(runs: list[dict[str, Any]], cfg: dict[str, Any], limit: int = 5) -> list[dict[str, Any]]:
    if not runs:
        return []
    scored: list[tuple[float, float, float, float, dict[str, Any]]] = []
    for r in runs:
        active_w = 0.0
        weighted_sq = 0.0
        n_missing = 0
        for feat, (rng, weight) in SIM_FEATURES.items():
            rv, cv = r.get(feat), cfg.get(feat)
            if rv in (None, "") or cv is None:
                n_missing += 1
                continue
            active_w += weight
            weighted_sq += weight * ((float(rv) - float(cv)) / rng) ** 2
        if active_w <= 0.0:
            sim = 0.0
        else:
            sim = math.exp(-8.0 * (weighted_sq / active_w)) * (0.85**n_missing)
            sim *= 1.0 if r.get("fuel_material") == cfg.get("fuel_material") else 0.6
            sim *= 1.0 if r.get("diluent_gas") == cfg.get("diluent_gas") else 0.9
            sim *= 100.0

        present = sum(r.get(k) not in (None, "") for k in OPTIONAL_OUTPUTS) / len(OPTIONAL_OUTPUTS)
        extras = min(len(r.get("extra_telemetry") or {}), 6) / 6.0
        comp = 70.0 * present + 30.0 * extras

        sev = REGIME_SEVERITY.get(str(r.get("combustion_regime") or ""), 0.0)
        flux_val = r.get("peak_radiative_flux_kw_m2")
        flux = min(max(float(flux_val), 0.0) / 10.0, 1.0) if flux_val not in (None, "") else 0.0
        loi = r.get("limiting_oxygen_index_pct")
        o2 = r.get("oxygen_pct")
        margin = (
            0.0
            if (loi in (None, "") or o2 in (None, ""))
            else min(max(float(o2) - float(loi), 0.0) / 10.0, 1.0)
        )
        crit = 60.0 * sev + 25.0 * flux + 15.0 * margin
        total = 0.5 * sim + 0.2 * comp + 0.3 * crit
        scored.append((total, sim, comp, crit, r))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [
        {
            "rank": idx + 1,
            "experiment_id": str(rec.get("experiment_id", f"RUN-{idx + 1}")),
            "total_score": round(total, 2),
            "similarity": round(sim, 2),
            "completeness": round(comp, 2),
            "criticality": round(crit, 2),
            "record": rec,
        }
        for idx, (total, sim, comp, crit, rec) in enumerate(scored[:limit])
    ]


# ---------------------------------------------------------------------------
# Embedded fallback HTTP server (started only if no EMBER backend is running)
# ---------------------------------------------------------------------------


class _LocalTelemetryStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._runs = _load_runs_for_local_ranker()
        self._history: deque[dict[str, Any]] = deque(maxlen=120)
        self._status = "idle"
        self._session_id: str | None = None
        self._experiment_name: str | None = None
        self._updated_at: str | None = None
        self._seq = 0
        self._started_mono: float | None = None
        self._last_mono: float | None = None
        self._top_matches: list[dict[str, Any]] = []

    def _snapshot_locked(self) -> dict[str, Any]:
        active = (
            self._status == "streaming"
            and self._last_mono is not None
            and (time.monotonic() - self._last_mono) <= 30.0
        )
        samples = list(self._history)
        return {
            "active": active,
            "status": self._status,
            "session_id": self._session_id,
            "experiment_name": self._experiment_name,
            "updated_at": self._updated_at,
            "sample_count": self._seq,
            "latest": samples[-1] if samples else None,
            "history": samples,
            "top_matches": list(self._top_matches),
        }

    def get_state(self) -> dict[str, Any]:
        with self._lock:
            return copy.deepcopy(self._snapshot_locked())

    def reset(self) -> dict[str, Any]:
        with self._lock:
            self._history.clear()
            self._status = "idle"
            self._session_id = None
            self._experiment_name = None
            self._updated_at = None
            self._seq = 0
            self._started_mono = None
            self._last_mono = None
            self._top_matches = []
            return copy.deepcopy(self._snapshot_locked())

    def ingest(self, payload: dict[str, Any]) -> dict[str, Any]:
        cfg = payload["config"]
        evaluation = evaluate_cabin_local(cfg)
        top_matches = rank_runs_local(self._runs, cfg, limit=5)
        now_mono = time.monotonic()
        now_iso = datetime.now(UTC).isoformat(timespec="seconds")

        with self._lock:
            if payload.get("reset"):
                self._history.clear()
                self._seq = 0
                self._started_mono = None

            if self._started_mono is None:
                self._started_mono = now_mono

            self._seq += 1
            ts = payload.get("timestamp_s")
            timestamp_s = round(float(ts), 3) if ts is not None else round(now_mono - self._started_mono, 3)

            if payload.get("session_id") is not None:
                self._session_id = str(payload["session_id"])
            if payload.get("experiment_name") is not None:
                self._experiment_name = str(payload["experiment_name"])
            self._status = str(payload.get("status") or "streaming")
            self._updated_at = now_iso
            self._last_mono = now_mono
            self._top_matches = top_matches

            self._history.append(
                {
                    "seq": self._seq,
                    "timestamp_s": timestamp_s,
                    "recorded_at": now_iso,
                    "phase": payload.get("phase"),
                    "event": payload.get("event"),
                    "config": cfg,
                    "raw_sensors": payload.get("raw_sensors"),
                    "evaluation": evaluation,
                }
            )
            return copy.deepcopy(self._snapshot_locked())


class _DualStackHTTPServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6
    allow_reuse_address = True

    def server_bind(self) -> None:
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


def _start_fallback_server(host: str, port: int, store: _LocalTelemetryStore) -> ThreadingHTTPServer:
    class Handler(BaseHTTPRequestHandler):
        def _send_json(self, code: int, body: dict[str, Any]) -> None:
            raw = json.dumps(body).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.end_headers()
            self.wfile.write(raw)

        def do_OPTIONS(self) -> None:  # noqa: N802
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.end_headers()

        def do_GET(self) -> None:  # noqa: N802
            path = urllib.parse.urlparse(self.path).path
            if path == "/api/health":
                self._send_json(
                    200,
                    {
                        "status": "ok",
                        "db": False,
                        "test_runs": len(store._runs),
                        "chunks": 0,
                        "llm_provider": "simulator-local",
                        "schema_version": "v1",
                    },
                )
            elif path == "/api/live-telemetry":
                self._send_json(200, store.get_state())
            else:
                self._send_json(
                    404,
                    {"error": {"code": "NOT_FOUND", "message": f"Unknown path {path}", "details": None}},
                )

        def do_POST(self) -> None:  # noqa: N802
            path = urllib.parse.urlparse(self.path).path
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length > 0 else b"{}"
            if path == "/api/live-telemetry/reset":
                self._send_json(200, store.reset())
                return
            if path == "/api/live-telemetry":
                try:
                    payload = json.loads(raw.decode("utf-8"))
                except json.JSONDecodeError as exc:
                    self._send_json(
                        422,
                        {"error": {"code": "VALIDATION_ERROR", "message": str(exc), "details": None}},
                    )
                    return
                self._send_json(200, store.ingest(payload))
                return
            self._send_json(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"Unknown path {path}", "details": None}},
            )

        def log_message(self, format: str, *args: Any) -> None:
            return  # keep terminal telemetry readout clean

    try:
        bind_host = "::" if host in ("localhost", "127.0.0.1", "0.0.0.0", "::") else host
        server: ThreadingHTTPServer = _DualStackHTTPServer((bind_host, port), Handler)
    except OSError:
        server = ThreadingHTTPServer(("127.0.0.1" if host == "localhost" else host, port), Handler)

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


# ---------------------------------------------------------------------------
# NASA microgravity combustion & habitat experiment trajectories
# ---------------------------------------------------------------------------


@dataclass
class ExperimentFrame:
    phase: str
    event: str | None
    oxygen_pct: float
    pressure_kpa: float
    flow_velocity_cm_s: float
    gravity_g: float
    fuel_material: str
    diluent_gas: str


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * _clamp(t, 0.0, 1.0)


def _generate_frame(
    scenario: str, idx: int, total: int, material_override: str | None, diluent_override: str | None
) -> ExperimentFrame:
    u = idx / max(1, total - 1)
    material = material_override
    diluent = diluent_override

    if scenario == "eva-prebreathe":
        mat = material or "Cotton-Fiberglass"
        dil = diluent or "N2"
        if u < 0.2:
            p = u / 0.2
            return ExperimentFrame(
                phase="ISS Standard Baseline",
                event="Baseline ECLSS telemetry lock" if idx == 0 else None,
                oxygen_pct=_lerp(21.0, 22.0, p),
                pressure_kpa=_lerp(101.3, 96.0, p),
                flow_velocity_cm_s=_lerp(10.0, 11.0, p),
                gravity_g=0.0,
                fuel_material=mat,
                diluent_gas=dil,
            )
        if u < 0.55:
            p = (u - 0.2) / 0.35
            return ExperimentFrame(
                phase="Airlock Depressurization",
                event="Cabin depressurization toward 56.5 kPa exploration mix"
                if abs(u - 0.2) < (1.0 / max(1, total))
                else None,
                oxygen_pct=_lerp(22.0, 34.0, p),
                pressure_kpa=_lerp(96.0, 56.5, p),
                flow_velocity_cm_s=_lerp(11.0, 15.0, p),
                gravity_g=0.0,
                fuel_material=mat,
                diluent_gas=dil,
            )
        if u < 0.8:
            p = (u - 0.55) / 0.25
            return ExperimentFrame(
                phase="Artemis 34% O2 Peak Hold",
                event="O2 spike to 37.5% — oxygen margin alert threshold"
                if idx == int(0.62 * total)
                else None,
                oxygen_pct=34.0 + 3.5 * math.sin(p * math.pi),
                pressure_kpa=56.5,
                flow_velocity_cm_s=_lerp(15.0, 9.0, p),
                gravity_g=0.0,
                fuel_material=mat,
                diluent_gas=dil,
            )
        p = (u - 0.8) / 0.2
        return ExperimentFrame(
            phase="N2 Repressurization",
            event="N2 makeup valves opened — returning to nominal" if idx == int(0.8 * total) else None,
            oxygen_pct=_lerp(34.0, 21.0, p),
            pressure_kpa=_lerp(56.5, 101.3, p),
            flow_velocity_cm_s=_lerp(9.0, 10.0, p),
            gravity_g=0.0,
            fuel_material=mat,
            diluent_gas=dil,
        )

    if scenario == "ventilation-paradox":
        mat = material or "Cotton-Fiberglass"
        dil = diluent or "N2"
        flow = 50.0 * u
        if flow < 4.0:
            phase = "Quiescent Microgravity (O2 Starved)"
            event = "Zero-flow radiative heat-loss regime" if idx == 0 else None
        elif flow < 15.0:
            phase = "Ventilation Paradox Zone (Peak Spread)"
            event = (
                "HVAC flow enters 8 cm/s ventilation paradox minimum LOI"
                if idx == int(0.12 * total)
                else None
            )
        elif flow < 32.0:
            phase = "Moderate Forced Convection"
            event = "Flow passing peak flame intensity band" if idx == int(0.4 * total) else None
        else:
            phase = "High-Flow Blow-Off Cooling"
            event = "Convective blow-off raises effective LOI" if idx == int(0.72 * total) else None
        return ExperimentFrame(
            phase=phase,
            event=event,
            oxygen_pct=24.0,
            pressure_kpa=101.3,
            flow_velocity_cm_s=flow,
            gravity_g=0.0,
            fuel_material=mat,
            diluent_gas=dil,
        )

    if scenario == "apollo-incident":
        mat = material or "Nomex"
        dil = diluent or ("N2" if u < 0.65 else "CO2")
        if u < 0.35:
            p = u / 0.35
            return ExperimentFrame(
                phase="O2 Enrichment Build",
                event="Chamber oxygen enriching past 30%" if idx == int(0.2 * total) else None,
                oxygen_pct=_lerp(24.0, 38.0, p),
                pressure_kpa=_lerp(80.0, 101.3, p),
                flow_velocity_cm_s=12.0,
                gravity_g=0.0,
                fuel_material=mat,
                diluent_gas=dil,
            )
        if u < 0.65:
            return ExperimentFrame(
                phase="Critical Over-Oxygenated Hold",
                event="Ignitor pulse — sustained burn risk critical" if idx == int(0.4 * total) else None,
                oxygen_pct=38.0,
                pressure_kpa=101.3,
                flow_velocity_cm_s=14.0,
                gravity_g=0.0,
                fuel_material=mat,
                diluent_gas=dil,
            )
        p = (u - 0.65) / 0.35
        return ExperimentFrame(
            phase="CO2 Inerting Suppression",
            event="CO2 suppression flood active (+3% LOI shift)" if idx == int(0.65 * total) else None,
            oxygen_pct=_lerp(38.0, 19.0, p),
            pressure_kpa=101.3,
            flow_velocity_cm_s=_lerp(14.0, 28.0, p),
            gravity_g=0.0,
            fuel_material=mat,
            diluent_gas=dil,
        )

    if scenario == "cool-flame-drop":
        mat = material or "Heptane"
        dil = diluent or "N2"
        if u < 0.25:
            p = u / 0.25
            return ExperimentFrame(
                phase="Droplet Ignition & 1g -> 0g Transition",
                event="Heptane droplet ignited — transitioning to microgravity" if idx == 0 else None,
                oxygen_pct=_lerp(24.5, 21.5, p),
                pressure_kpa=101.3,
                flow_velocity_cm_s=_lerp(6.0, 2.0, p),
                gravity_g=_lerp(1.0, 0.0, p),
                fuel_material=mat,
                diluent_gas=dil,
            )
        if u < 0.68:
            p = (u - 0.25) / 0.43
            return ExperimentFrame(
                phase="Two-Stage Radiative Cool Flame",
                event="Hot flame extinguished radiatively — low-T cool flame sustained"
                if idx == int(0.28 * total)
                else None,
                oxygen_pct=_lerp(21.5, 17.0, p),
                pressure_kpa=_lerp(101.3, 82.0, p),
                flow_velocity_cm_s=_lerp(2.0, 1.0, p),
                gravity_g=0.0,
                fuel_material=mat,
                diluent_gas=dil,
            )
        p = (u - 0.68) / 0.32
        return ExperimentFrame(
            phase="Cool-Flame Extinction",
            event="Oxygen depleted below cool-flame limit — droplet extinguished"
            if idx == int(0.7 * total) or idx == total - 1
            else None,
            oxygen_pct=_lerp(17.0, 10.5, p),
            pressure_kpa=_lerp(82.0, 101.3, p),
            flow_velocity_cm_s=_lerp(1.0, 5.0, p),
            gravity_g=0.0,
            fuel_material=mat,
            diluent_gas=dil,
        )

    # Default: "sofie-ramp" (SoFIE Solid Fuel Ignition & Extinction oxygen ramp)
    mat = material or "PMMA"
    dil = diluent or "N2"
    if u < 0.18:
        p = u / 0.18
        return ExperimentFrame(
            phase="Pre-Ignition Conditioning",
            event="SoFIE flow tunnel stabilized at 0 g" if idx == 0 else None,
            oxygen_pct=_lerp(21.0, 23.0, p),
            pressure_kpa=_lerp(101.3, 85.0, p),
            flow_velocity_cm_s=_lerp(10.0, 9.0, p),
            gravity_g=0.0,
            fuel_material=mat,
            diluent_gas=dil,
        )
    if u < 0.48:
        p = (u - 0.18) / 0.30
        return ExperimentFrame(
            phase="O2 Enrichment & Ignition",
            event="Hot-wire ignitor energized — flame spread onset" if idx == int(0.32 * total) else None,
            oxygen_pct=_lerp(23.0, 35.0, p),
            pressure_kpa=_lerp(85.0, 70.3, p),
            flow_velocity_cm_s=_lerp(9.0, 12.0, p),
            gravity_g=0.0,
            fuel_material=mat,
            diluent_gas=dil,
        )
    if u < 0.75:
        p = (u - 0.48) / 0.27
        return ExperimentFrame(
            phase="Sustained Microgravity Burn",
            event="Peak radiative heat flux recorded" if idx == int(0.62 * total) else None,
            oxygen_pct=35.0 + 1.5 * math.sin(p * math.pi),
            pressure_kpa=70.3,
            flow_velocity_cm_s=_lerp(12.0, 8.5, p),
            gravity_g=0.0,
            fuel_material=mat,
            diluent_gas=dil,
        )
    p = (u - 0.75) / 0.25
    return ExperimentFrame(
        phase="N2 Purge & Extinction",
        event="N2 purge initiated — quenching flame front" if idx == int(0.76 * total) else None,
        oxygen_pct=_lerp(35.0, 16.5, p),
        pressure_kpa=_lerp(70.3, 101.3, p),
        flow_velocity_cm_s=_lerp(8.5, 22.0, p),
        gravity_g=0.0,
        fuel_material=mat,
        diluent_gas=dil,
    )


SCENARIO_TITLES: dict[str, str] = {
    "sofie-ramp": "SoFIE PMMA Oxygen Ramp (ISS MSG)",
    "eva-prebreathe": "Artemis EVA Airlock Pre-Breathe Transient",
    "ventilation-paradox": "Microgravity HVAC Ventilation Paradox Sweep",
    "apollo-incident": "High-O2 Overpressure & CO2 Suppression Test",
    "cool-flame-drop": "FLEX Heptane Droplet & Cool-Flame Regime",
}


def _http_json(
    method: str, url: str, payload: dict[str, Any] | None = None, timeout: float = 3.0
) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _is_backend_up(base_url: str) -> bool:
    try:
        _http_json("GET", f"{base_url}/api/health", timeout=1.5)
        return True
    except Exception:
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Stream live simulated NASA lab cabin data into EMBER.")
    parser.add_argument(
        "--url", default="http://localhost:8000", help="EMBER API base URL (default: http://localhost:8000)"
    )
    parser.add_argument(
        "--scenario",
        choices=list(SCENARIO_TITLES.keys()),
        default="sofie-ramp",
        help="Experiment trajectory to simulate",
    )
    parser.add_argument(
        "--interval", type=float, default=1.0, help="Seconds between telemetry frames (default: 1.0)"
    )
    parser.add_argument("--steps", type=int, default=45, help="Frames per experiment run (default: 45)")
    parser.add_argument("--loop", action="store_true", help="Continuously loop the simulated experiment")
    parser.add_argument(
        "--material", choices=list(FUEL_MATERIALS), default=None, help="Override fuel material"
    )
    parser.add_argument(
        "--diluent", choices=list(DILUENT_SHIFT.keys()), default=None, help="Override diluent gas"
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed for sensor noise")
    parser.add_argument(
        "--no-reset",
        action="store_true",
        help="Append frames without resetting the existing server stream buffer on step 0",
    )
    parser.add_argument(
        "--no-linger",
        action="store_true",
        help="Exit immediately after the final frame even when running the embedded server",
    )
    args = parser.parse_args()

    if args.steps < 1:
        parser.error("--steps must be >= 1")
    if args.interval < 0:
        parser.error("--interval must be >= 0")

    base_url = args.url.rstrip("/")
    parsed = urllib.parse.urlparse(base_url)
    rng = random.Random(args.seed)

    fallback_server: ThreadingHTTPServer | None = None
    local_store: _LocalTelemetryStore | None = None

    if _is_backend_up(base_url):
        print(f"[EMBER Simulator] Connected to EMBER backend at {base_url}")
    else:
        host = parsed.hostname or "localhost"
        port = parsed.port or 8000
        local_store = _LocalTelemetryStore()
        fallback_server = _start_fallback_server(host, port, local_store)
        print(
            f"[EMBER Simulator] No backend detected at {base_url}; "
            f"started embedded telemetry server on http://{host}:{port}"
        )

    session_counter = 0
    try:
        while True:
            session_counter += 1
            session_id = f"sim-{args.scenario}-{session_counter:02d}"
            exp_name = SCENARIO_TITLES[args.scenario]
            print(f"\n[EMBER Simulator] Starting '{exp_name}' ({args.steps} steps @ {args.interval:.2f}s)")
            print(
                "  step |   t (s) |    O2 % |  P (kPa) | Flow (cm/s) |  Risk | Band     | "
                "Regime            | Event"
            )
            print(
                "  -----+---------+---------+----------+-------------+-------+----------+"
                "-------------------+------"
            )

            for idx in range(args.steps):
                frame = _generate_frame(args.scenario, idx, args.steps, args.material, args.diluent)
                is_last = (idx == args.steps - 1) and not args.loop

                o2_raw = round(_clamp(frame.oxygen_pct + rng.gauss(0.0, 0.18), 10.0, 60.0), 3)
                p_raw = round(_clamp(frame.pressure_kpa + rng.gauss(0.0, 0.25), 20.0, 150.0), 3)
                flow_raw = round(_clamp(frame.flow_velocity_cm_s + rng.gauss(0.0, 0.35), 0.0, 50.0), 3)
                g_raw = round(_clamp(frame.gravity_g + abs(rng.gauss(0.0, 0.002)), 0.0, 1.0), 4)

                cfg_dict = {
                    "oxygen_pct": round(_clamp(frame.oxygen_pct, 10.0, 60.0), 2),
                    "pressure_kpa": round(_clamp(frame.pressure_kpa, 20.0, 150.0), 2),
                    "flow_velocity_cm_s": round(_clamp(frame.flow_velocity_cm_s, 0.0, 50.0), 2),
                    "gravity_g": round(_clamp(frame.gravity_g, 0.0, 1.0), 3),
                    "fuel_material": frame.fuel_material,
                    "diluent_gas": frame.diluent_gas,
                }
                est_loi = limiting_oxygen_index(cfg_dict)
                margin = frame.oxygen_pct - est_loi
                regime = predict_regime(frame.fuel_material, frame.gravity_g, margin)
                burning = margin >= 0.0

                if regime == "Cool Flame":
                    flame_temp_k = round(max(295.0, 680.0 + 22.0 * margin + rng.gauss(0.0, 10.0)), 1)
                    rad_flux = round(max(0.05, 0.45 + 0.12 * margin + rng.gauss(0.0, 0.05)), 2)
                    flame_radius = round(
                        max(1.0, 4.2 + 0.5 * margin + 0.8 * math.sin(idx * 0.25) + rng.gauss(0.0, 0.15)),
                        2,
                    )
                elif burning:
                    flame_temp_k = round(max(295.0, 1250.0 + 58.0 * margin + rng.gauss(0.0, 14.0)), 1)
                    rad_flux = round(max(0.0, 1.6 + 0.65 * margin + rng.gauss(0.0, 0.15)), 2)
                    flame_radius = round(
                        max(0.0, 8.0 + 1.4 * margin + 2.5 * math.sin(idx * 0.25) + rng.gauss(0.0, 0.3)),
                        2,
                    )
                else:
                    flame_temp_k = round(296.0 + max(0.0, margin + 2.0) * 85.0 + abs(rng.gauss(0.0, 2.0)), 1)
                    rad_flux = round(max(0.0, 0.08 + rng.gauss(0.0, 0.03)), 2)
                    flame_radius = 0.0

                payload = {
                    "session_id": session_id,
                    "experiment_name": exp_name,
                    "phase": frame.phase,
                    "event": frame.event or ("Experiment run completed" if is_last else None),
                    "status": "completed" if is_last else "streaming",
                    "timestamp_s": round(idx * args.interval, 2),
                    "reset": (idx == 0 and not args.no_reset),
                    "config": cfg_dict,
                    "raw_sensors": {
                        "oxygen_pct_raw": o2_raw,
                        "pressure_kpa_raw": p_raw,
                        "flow_velocity_cm_s_raw": flow_raw,
                        "gravity_g_raw": g_raw,
                        "flame_temp_k": flame_temp_k,
                        "radiative_heat_flux_kw_m2": rad_flux,
                        "flame_radius_mm": flame_radius,
                    },
                }

                if local_store is not None:
                    state = local_store.ingest(payload)
                else:
                    try:
                        state = _http_json("POST", f"{base_url}/api/live-telemetry", payload)
                    except urllib.error.URLError as exc:
                        print(f"  [warn] failed to reach {base_url}: {exc}")
                        time.sleep(args.interval)
                        continue

                latest = state["latest"]
                ev = latest["evaluation"]
                ev_str = latest.get("event") or "-"
                print(
                    f"  {latest['seq']:4d} | {latest['timestamp_s']:7.1f} | "
                    f"{cfg_dict['oxygen_pct']:7.2f} | {cfg_dict['pressure_kpa']:8.2f} | "
                    f"{cfg_dict['flow_velocity_cm_s']:11.2f} | {ev['risk_index']:5.1f} | "
                    f"{ev['risk_band']:<8s} | {ev['predicted_regime']:<17s} | {ev_str}"
                )

                if idx < args.steps - 1 and args.interval > 0:
                    time.sleep(args.interval)

            if not args.loop:
                break
            if args.interval > 0:
                time.sleep(args.interval)

        if fallback_server is not None and not args.no_linger:
            print(
                "\n[EMBER Simulator] Run complete. "
                "Keeping embedded telemetry server alive (Ctrl+C to exit)..."
            )
            while True:
                time.sleep(1.0)
    except KeyboardInterrupt:
        print("\n[EMBER Simulator] Stopped by user.")
    finally:
        if fallback_server is not None:
            fallback_server.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
