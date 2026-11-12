"""Build contracts/fixtures/domain_parity.json from the CURRENT Python domain code (ember_data).

Python (pytest) and TS (vitest) both assert against this file so the two copies of the math stay identical.

Run from the repo root (old layout, uv workspace):
    uv run python scripts/build_parity_fixtures.py
"""
from __future__ import annotations

import json
from pathlib import Path

from ember_data.models.risk import evaluate_cabin
from ember_data.ranking.scenario_ranker import rank_runs
from ember_data.schema import CabinConfig

REPO_ROOT = Path(__file__).resolve().parents[1]
MOCK_DATA = REPO_ROOT / "contracts" / "mock_data"
OUT_PATH = REPO_ROOT / "contracts" / "fixtures" / "domain_parity.json"

CONFIG_KEYS = ("oxygen_pct", "pressure_kpa", "flow_velocity_cm_s", "gravity_g", "fuel_material", "diluent_gas")


def cfg(o2: float, p: float, flow: float, g: float, fuel: str, dil: str) -> dict:
    return dict(zip(CONFIG_KEYS, (o2, p, flow, g, fuel, dil)))


# Fields the step left unspecified use sea-level air (21% O2, 101.3 kPa, 10 cm/s) where possible.
EDGE_CASES: list[tuple[str, dict]] = [
    ("edge-pmma-0g-flow0", cfg(21.0, 101.3, 0.0, 0.0, "PMMA", "N2")),
    ("edge-pmma-0g-flow8", cfg(21.0, 101.3, 8.0, 0.0, "PMMA", "N2")),
    ("edge-pmma-0g-flow45", cfg(21.0, 101.3, 45.0, 0.0, "PMMA", "N2")),
    ("edge-heptane-0g-flow0", cfg(21.0, 101.3, 0.0, 0.0, "Heptane", "N2")),
    ("edge-nomex-co2-lunar-40kpa-o2-30", cfg(30.0, 40.0, 10.0, 0.16, "Nomex", "CO2")),
    ("edge-methanol-he-mars-70kpa", cfg(26.5, 70.0, 10.0, 0.38, "Methanol", "He")),
    ("edge-cotton-ar-1g", cfg(21.0, 101.3, 10.0, 1.0, "Cotton-Fiberglass", "Ar")),
    # O2 == estimated LOI (17.26%) for the ISS cabin -> zero oxygen margin, sigmoid boundary
    ("edge-cotton-0g-o2-at-loi", cfg(17.26, 101.3, 10.0, 0.0, "Cotton-Fiberglass", "N2")),
]

TOP5_KEYS = ("experiment_id", "total_score", "similarity", "completeness", "criticality")


def main() -> None:
    runs = json.loads((MOCK_DATA / "experiments_proxy.json").read_text(encoding="utf-8"))
    presets = json.loads((MOCK_DATA / "presets.json").read_text(encoding="utf-8"))

    inputs = [(f"preset-{p['id']}", {k: p[k] for k in CONFIG_KEYS}) for p in presets] + EDGE_CASES

    cases = []
    for case_id, config in inputs:
        evaluation = evaluate_cabin(CabinConfig(**config)).to_dict()
        ranked = rank_runs(runs, config, limit=5)
        cases.append({
            "id": case_id,
            "config": config,
            "evaluation": evaluation,
            "top5": [{k: getattr(r, k) for k in TOP5_KEYS} for r in ranked],
        })

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps({"runs": runs, "cases": cases}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH.relative_to(REPO_ROOT)}: {len(runs)} runs, {len(cases)} cases")


if __name__ == "__main__":
    main()
