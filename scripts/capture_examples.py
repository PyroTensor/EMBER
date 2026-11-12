"""Capture one example response per endpoint from the CURRENT backend into contracts/examples/.

Run from the repo root (old layout, uv workspace):
    uv run python scripts/capture_examples.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

PRESETS_PATH = REPO_ROOT / "contracts" / "mock_data" / "presets.json"
OUT_DIR = REPO_ROOT / "contracts" / "examples"

CONFIG_KEYS = ("oxygen_pct", "pressure_kpa", "flow_velocity_cm_s", "gravity_g", "fuel_material", "diluent_gas")


def iss_config() -> dict:
    presets = json.loads(PRESETS_PATH.read_text(encoding="utf-8"))
    iss = next(p for p in presets if p["id"] == "iss")
    return {k: iss[k] for k in CONFIG_KEYS}


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cfg = iss_config()
    client = TestClient(app)

    calls = {
        "health": ("GET", "/api/health", None),
        "presets": ("GET", "/api/presets", None),
        "evaluate-cabin": ("POST", "/api/evaluate-cabin", cfg),
        "experiments": ("GET", "/api/experiments", None),
        "rank": ("POST", "/api/experiments/rank", {"config": cfg}),
        "telemetry_EXP-0001": ("GET", "/api/telemetry/EXP-0001", None),
        "copilot-ask": ("POST", "/api/copilot/ask", {"question": "What is the ventilation paradox?", "scenario": cfg}),
    }

    for name, (method, path, body) in calls.items():
        resp = client.request(method, path, json=body)
        if resp.status_code != 200:
            raise SystemExit(f"{method} {path} -> {resp.status_code}: {resp.text[:500]}")
        out = OUT_DIR / f"{name}.json"
        out.write_text(json.dumps(resp.json(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"{method:4} {path:32} -> {out.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
