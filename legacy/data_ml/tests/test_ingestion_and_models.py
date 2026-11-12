"""Unit tests for Squad 1 (data_ml): schema sync, normalization, validation, risk Shapley, and ranking."""
from __future__ import annotations

import json

from ember_data import MOCK_DATA_DIR, SCHEMA_PATH
from ember_data.ingestion import normalize, parse, validate
from ember_data.models.risk import evaluate_cabin
from ember_data.ranking.scenario_ranker import rank_runs
from ember_data.schema import CabinConfig, TestRun


def test_schema_sync_with_json_contract():
    schema = json.loads(SCHEMA_PATH.read_text())
    contract_props = set(schema["properties"].keys())
    pydantic_props = set(TestRun.model_fields.keys())
    assert contract_props == pydantic_props


def test_normalize_messy_nov14_drop_and_extra_telemetry():
    raw_rows = parse.read_rows(MOCK_DATA_DIR / "raw_drop_example.csv")
    norm = normalize.normalize_rows(raw_rows)
    assert len(norm) == 12
    first = norm[0]
    assert first["gravity_g"] == 0.0
    assert abs(first["pressure_kpa"] - 101.3) < 0.2
    assert first["combustion_regime"] in {"Sustained Burn", "Self-Extinguished", "Cool Flame", "No Ignition"}
    # Unknown columns must land in extra_telemetry without being dropped
    assert "Camera_FPS" in first["extra_telemetry"]


def test_validate_rows_accepts_proxy_and_rejects_bad_bounds():
    raw_rows = parse.read_rows(MOCK_DATA_DIR / "experiments_proxy.csv")
    norm = normalize.normalize_rows(raw_rows)
    rep = validate.validate_rows(norm, write_queue=False)
    assert len(rep.valid) == 50
    assert len(rep.rejected) == 0

    bad = dict(norm[0], oxygen_pct=95.0)  # outside [15, 40]
    rep2 = validate.validate_rows([bad], write_queue=False)
    assert len(rep2.valid) == 0
    assert len(rep2.rejected) == 1


def test_risk_shapley_contributions_sum_to_delta_from_baseline():
    presets = json.loads((MOCK_DATA_DIR / "presets.json").read_text())
    for p in presets:
        cfg = CabinConfig(**{k: p[k] for k in CabinConfig.model_fields})
        ev = evaluate_cabin(cfg)
        contrib_sum = sum(c.value for c in ev.contributions)
        delta = ev.risk_index - ev.baseline_risk
        assert abs(contrib_sum - delta) < 0.15, f"Preset {p['id']}: {contrib_sum} != {delta}"


def test_scenario_ranker_orders_matching_runs_first():
    runs = json.loads((MOCK_DATA_DIR / "experiments_proxy.json").read_text())
    target = {
        "oxygen_pct": 34.0,
        "pressure_kpa": 56.5,
        "flow_velocity_cm_s": 10.0,
        "gravity_g": 0.0,
        "fuel_material": "Cotton-Fiberglass",
        "diluent_gas": "N2",
    }
    ranked = rank_runs(runs, target, limit=5)
    assert len(ranked) == 5
    assert ranked[0].total_score >= ranked[-1].total_score
    assert 0.0 <= ranked[0].total_score <= 100.0
