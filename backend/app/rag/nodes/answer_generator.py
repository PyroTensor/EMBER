"""LangGraph Node - Answer generator: cites [DOC-XX p.Y] and [EXP-XXXX] per claim; 'no data' when missing."""

from __future__ import annotations

import re
from typing import Any

from app.core.constants import NO_DATA_MESSAGE
from app.domain.risk.fire_risk import evaluate_cabin
from app.domain.types import ISS_BASELINE, CabinParams
from app.rag.prompts import load_prompt
from app.rag.state import EvidenceItem, GraphState
from app.rag.toolkit import RagToolkit


def _clean_sentence(text: str) -> str:
    s = re.sub(r"\[[A-Za-z0-9_-]+\s+p\.\d+\s*-\s*[^\]]*\]\s*", "", text)
    s = re.sub(r"^>.*$", "", s, flags=re.MULTILINE)
    s = re.sub(r"#+\s*", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _best_sentences(chunk_text: str, question: str, max_sentences: int = 2) -> list[str]:
    cleaned = _clean_sentence(chunk_text)
    raw_sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", cleaned) if len(s.strip()) > 35]
    q_terms = {w for w in re.findall(r"[a-z0-9-]+", question.lower()) if len(w) > 2}

    scored = []
    for s in raw_sents:
        if s.startswith("|") or "PROXY DOCUMENT" in s or "PROXY ISS" in s:
            continue
        words = set(re.findall(r"[a-z0-9-]+", s.lower()))
        scored.append((len(words & q_terms), s))
    scored.sort(key=lambda t: t[0], reverse=True)
    return [s for _, s in scored[:max_sentences]]


def _format_scenario_context(scenario: dict[str, Any] | None) -> str:
    if not scenario:
        return ""
    try:
        params = CabinParams(
            oxygen_pct=float(scenario.get("oxygen_pct", 21.0)),
            pressure_kpa=float(scenario.get("pressure_kpa", 101.3)),
            flow_velocity_cm_s=float(scenario.get("flow_velocity_cm_s", 10.0)),
            gravity_g=float(scenario.get("gravity_g", 0.0)),
            fuel_material=str(scenario.get("fuel_material", "Cotton-Fiberglass")),
            diluent_gas=str(scenario.get("diluent_gas", "N2")),
        )
        risk = evaluate_cabin(params, ISS_BASELINE)
        return (
            "User's Active Cabin Configuration:\n"
            f"- Atmosphere & Fuel: {params.oxygen_pct}% O2, {params.pressure_kpa} kPa, "
            f"{params.flow_velocity_cm_s} cm/s HVAC flow, {params.gravity_g}g gravity, "
            f"fuel={params.fuel_material}, diluent={params.diluent_gas}\n"
            f"- Physics Evaluation: Spacecraft Fire Risk Index = {risk.risk_index}/100 ({risk.risk_band}, "
            f"vs ISS baseline {risk.baseline_risk}/100), Estimated LOI = {risk.estimated_loi_pct}%, "
            f"O2 margin over LOI = {risk.oxygen_margin_pct:+.2f} percentage points, "
            f"Predicted Regime = {risk.predicted_regime}\n\n"
        )
    except Exception:
        return f"User's Active Cabin Configuration: {scenario}\n\n"


def _synthesize_heuristic(
    question: str,
    evidence: list[EvidenceItem],
    scenario: dict[str, Any] | None = None,
) -> tuple[str, bool]:
    chunks = [e for e in evidence if e["kind"] == "chunk" and e.get("doc_id") and e.get("page")]
    runs = [e for e in evidence if e["kind"] in ("test_run", "ranked_run") and e.get("experiment_id")]

    if not chunks and not runs:
        return NO_DATA_MESSAGE, False

    claims: list[str] = []
    if scenario and runs:
        top_exp = runs[0]["experiment_id"]
        try:
            params = CabinParams(
                oxygen_pct=float(scenario.get("oxygen_pct", 21.0)),
                pressure_kpa=float(scenario.get("pressure_kpa", 101.3)),
                flow_velocity_cm_s=float(scenario.get("flow_velocity_cm_s", 10.0)),
                gravity_g=float(scenario.get("gravity_g", 0.0)),
                fuel_material=str(scenario.get("fuel_material", "Cotton-Fiberglass")),
                diluent_gas=str(scenario.get("diluent_gas", "N2")),
            )
            risk = evaluate_cabin(params, ISS_BASELINE)
            claims.append(
                f"For the configured cabin scenario ({params.oxygen_pct}% O2, {params.pressure_kpa} kPa, "
                f"{params.flow_velocity_cm_s} cm/s flow, {params.gravity_g}g, {params.fuel_material} in "
                f"{params.diluent_gas}), the Spacecraft Fire Risk Index is {risk.risk_index}/100 "
                f"({risk.risk_band}) with an estimated LOI of {risk.estimated_loi_pct}% and predicted regime "
                f"{risk.predicted_regime}, most closely matched by {top_exp} [{top_exp}]."
            )
        except Exception:
            pass

    for c in chunks[:3]:
        tag = f"[{c['doc_id']} p.{c['page']}]"
        for sent in _best_sentences(c["text"], question, max_sentences=2):
            sent = sent.rstrip(".")
            claims.append(f"{sent} {tag}.")
            if len(claims) >= 3:
                break
        if len(claims) >= 3:
            break

    if runs:
        top_runs = runs[:2]
        run_summaries = []
        for r in top_runs:
            m = re.search(r"([A-Z0-9-]+)\s*\(([^)]+)\):\s*([^->]+)->\s*([^()]+)", r["text"])
            if m:
                eid, meta, cond, out = m.groups()
                run_summaries.append(
                    f"Experiment {eid.strip()} ({meta.strip()} at {cond.strip()}) recorded {out.strip()} "
                    f"[{r['experiment_id']}]"
                )
            else:
                run_summaries.append(f"{r['text']} [{r['experiment_id']}]")
        claims.append(" ".join(s.rstrip(".") + "." for s in run_summaries))

    if not claims:
        return NO_DATA_MESSAGE, False
    return " ".join(claims), True


async def answer_generator_node(state: GraphState, tk: RagToolkit) -> dict[str, Any]:
    if state.get("route") == "out_of_scope":
        return {"answer": NO_DATA_MESSAGE, "supported": False}

    evidence = state.get("evidence") or []
    if not evidence:
        return {"answer": NO_DATA_MESSAGE, "supported": False}

    scenario = state.get("scenario")
    if tk.llm.name != "heuristic":
        context = "\n".join(f"- {e['text']}" for e in evidence[: tk.settings.RAG_ANSWER_EVIDENCE])
        scenario_block = _format_scenario_context(scenario)
        user_msg = f"Question: {state['original_question']}\n\n{scenario_block}Evidence:\n{context}"
        ans = await tk.llm.complete(load_prompt("answer"), user_msg)
        if ans.lower().startswith("no data"):
            return {"answer": NO_DATA_MESSAGE, "supported": False}
        return {"answer": ans, "supported": True}

    ans, supported = _synthesize_heuristic(
        state.get("original_question") or state["question"], evidence, scenario=scenario
    )
    return {"answer": ans, "supported": supported}


__all__ = ["answer_generator_node"]
