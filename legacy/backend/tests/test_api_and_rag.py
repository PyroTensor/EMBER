"""Integration and unit tests for Squad 2 (backend): FastAPI endpoints, LangGraph RAG, and citation check."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.rag.nodes.citation_check import verify_and_extract_citations

client = TestClient(app)


def test_health_endpoint():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["test_runs"] == 50
    assert body["chunks"] > 0
    assert "psi_investigation_code" in body["extra_telemetry_keys"]


def test_presets_and_evaluate_cabin():
    presets = client.get("/api/presets").json()
    assert len(presets) >= 4
    artemis = next(p for p in presets if "artemis" in p["id"])
    ev = client.post("/api/evaluate-cabin", json=artemis).json()
    assert ev["risk_index"] > 80
    assert ev["risk_band"] == "CRITICAL"
    assert len(ev["contributions"]) == 5


def test_experiments_rank_and_telemetry():
    exps = client.get("/api/experiments", params={"program": "FLEX"}).json()
    assert len(exps) == 12

    rank_res = client.post(
        "/api/experiments/rank",
        json={
            "config": {
                "oxygen_pct": 21.0,
                "pressure_kpa": 101.3,
                "flow_velocity_cm_s": 10.0,
                "gravity_g": 0.0,
                "fuel_material": "Cotton-Fiberglass",
                "diluent_gas": "N2",
            },
            "limit": 5,
        },
    ).json()
    assert len(rank_res["results"]) == 5
    top_id = rank_res["results"][0]["experiment_id"]

    tel = client.get(f"/api/telemetry/{top_id}")
    assert tel.status_code == 200
    assert len(tel.json()["time_s"]) == 40

    missing = client.get("/api/telemetry/EXP-9999")
    assert missing.status_code == 404


def test_copilot_ask_supported_and_out_of_scope():
    r1 = client.post(
        "/api/copilot/ask",
        json={"question": "Does low-speed ventilation make microgravity flames more dangerous?"},
    )
    assert r1.status_code == 200
    b1 = r1.json()
    assert b1["supported"] is True
    assert len(b1["citations"]) >= 1
    assert b1["dropped_claims"] == []

    r2 = client.post(
        "/api/copilot/ask",
        json={"question": "What is the best recipe for chocolate chip cookies?"},
    )
    assert r2.status_code == 200
    b2 = r2.json()
    assert b2["supported"] is False
    assert b2["route"] == "out_of_scope"
    assert b2["citations"] == []


def test_citation_check_strips_unverified_sentences():
    evidence = [
        {
            "id": "DOC-01:p1",
            "kind": "chunk",
            "source": "hybrid_retriever",
            "score": 0.9,
            "text": "Low-speed forced flow of 5-10 cm/s lowers the LOI in microgravity.",
            "doc_id": "DOC-01",
            "page": 1,
            "experiment_id": None,
        },
        {
            "id": "EXP-0005",
            "kind": "test_run",
            "source": "sql_tool",
            "score": 0.9,
            "text": "EXP-0005 sustained burn at 5 cm/s.",
            "doc_id": "DOC-01",
            "page": 1,
            "experiment_id": "EXP-0005",
        },
    ]
    raw_answer = (
        "Low-speed forced flow lowers the LOI in microgravity [DOC-01 p.1]. "
        "This sentence has no citation at all and must be dropped. "
        "This sentence cites a non-existent page [DOC-99 p.9]. "
        "Experiment EXP-0005 burned at 5 cm/s [EXP-0005]."
    )
    cleaned, supported, citations, dropped = verify_and_extract_citations(raw_answer, evidence, supported=True)
    assert supported is True
    assert len(citations) == 2
    assert len(dropped) == 2
    assert "DOC-99" not in cleaned
    assert "no citation at all" not in cleaned
