"""Golden-set evaluation for the EMBER grounded RAG pipeline.

Calls ``POST /api/copilot/ask`` in-process (``httpx.ASGITransport``) inside the app lifespan, so the DB probe,
LLM provider and embedder are initialised exactly as in production; no running server is needed.

Metrics (gated by ``eval/thresholds.yaml``):
  supported_accuracy        share of questions whose ``supported`` flag matches ``expected_supported``
                            (including 'no data' on out-of-scope questions)
  expected_citation_recall  share of all ``expected_docs`` / ``expected_exps`` ids found in the verified
                            citations
  leaked_unverified_claims  in supported answers: sentences without a citation tag, tags without a matching
                            citation, and citations whose doc page / experiment is not in ``evidence``

Writes ``eval/results/<timestamp>.json`` and exits 1 when any threshold is not met.
Usage (from backend/): ``make eval`` or ``uv run python eval/run_eval.py``.
"""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import yaml

EVAL_DIR = Path(__file__).resolve().parent
BACKEND_DIR = EVAL_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))  # eval/ is not a package; make `app` importable

from app.core.config import get_settings  # noqa: E402
from app.llm.factory import get_llm_provider  # noqa: E402
from app.main import create_app  # noqa: E402
from app.rag.citations import DOC_CITE, EXP_CITE, split_sentences  # noqa: E402
from eval.tracing import configure_tracing  # noqa: E402

GOLDEN_FILE = EVAL_DIR / "golden_set.jsonl"
THRESHOLDS_FILE = EVAL_DIR / "thresholds.yaml"
RESULTS_DIR = EVAL_DIR / "results"
ASK_URL = "/api/copilot/ask"


def load_golden() -> list[dict[str, Any]]:
    lines = GOLDEN_FILE.read_text(encoding="utf-8").splitlines()
    return [json.loads(line) for line in lines if line.strip()]


def leaked_claims(res: dict[str, Any]) -> list[str]:
    """Unverified content that slipped past citation_check (empty for unsupported answers)."""
    if not res.get("supported"):
        return []
    evidence = res.get("evidence") or []
    ev_pages = {(e.get("doc_id"), e.get("page")) for e in evidence}
    ev_exps = {e.get("experiment_id") for e in evidence if e.get("experiment_id")}
    cite_ids = {c["id"] for c in res.get("citations") or []}

    leaks: list[str] = []
    for sent in split_sentences(res.get("answer", "")):
        tags = [f"[{d} p.{p}]" for d, p in DOC_CITE.findall(sent)]
        tags += [f"[{e}]" for e in EXP_CITE.findall(sent)]
        if not tags:
            leaks.append(f"uncited sentence: {sent}")
        leaks += [f"tag without citation: {t}" for t in tags if t not in cite_ids]
    for c in res.get("citations") or []:
        if c["kind"] == "doc":
            backed = (c.get("doc_id"), c.get("page")) in ev_pages
        else:
            backed = c.get("experiment_id") in ev_exps
        if not backed:
            leaks.append(f"citation not in evidence: {c['id']}")
    return leaks


def score_item(item: dict[str, Any], res: dict[str, Any]) -> dict[str, Any]:
    citations = res.get("citations") or []
    cited_docs = {c["doc_id"] for c in citations if c["kind"] == "doc" and c.get("doc_id")}
    cited_exps = {c["experiment_id"] for c in citations if c.get("experiment_id")}
    expected = [*item.get("expected_docs", []), *item.get("expected_exps", [])]
    found = [x for x in item.get("expected_docs", []) if x in cited_docs]
    found += [x for x in item.get("expected_exps", []) if x in cited_exps]
    leaks = leaked_claims(res)
    supported_ok = bool(res.get("supported")) == bool(item["expected_supported"])
    return {
        "id": item["id"],
        "question": item["question"],
        "route": res.get("route"),
        "supported": res.get("supported"),
        "expected_supported": item["expected_supported"],
        "supported_ok": supported_ok,
        "expected_ids": expected,
        "found_ids": found,
        "citations": [c["id"] for c in citations],
        "rewrites": res.get("rewrites"),
        "leaks": leaks,
        "passed": supported_ok and len(found) == len(expected) and not leaks,
        "trace_id": res.get("trace_id"),
        "answer": res.get("answer"),
    }


def check_thresholds(metrics: dict[str, float], thresholds: dict[str, dict[str, float]]) -> list[str]:
    failures: list[str] = []
    for name, rule in thresholds.items():
        value = metrics.get(name)
        if value is None:
            failures.append(f"{name}: metric not computed")
            continue
        if "min" in rule and value < rule["min"]:
            failures.append(f"{name}={value:.3f} < {rule['min']}")
        if "max" in rule and value > rule["max"]:
            failures.append(f"{name}={value:.3f} > {rule['max']}")
        if "eq" in rule and value != rule["eq"]:
            failures.append(f"{name}={value:g} != {rule['eq']}")
    return failures


async def run_golden(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    app = create_app()
    rows: list[dict[str, Any]] = []
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://eval", timeout=120) as client:
            for item in items:
                resp = await client.post(ASK_URL, json={"question": item["question"]})
                if resp.status_code != 200:
                    res: dict[str, Any] = {"supported": None, "route": f"HTTP {resp.status_code}"}
                else:
                    res = resp.json()
                rows.append(score_item(item, res))
    return rows


def main() -> int:
    settings = get_settings()
    tracing = configure_tracing(settings)
    items = load_golden()
    thresholds = yaml.safe_load(THRESHOLDS_FILE.read_text(encoding="utf-8"))

    rows = asyncio.run(run_golden(items))

    for r in rows:
        status = "PASS" if r["passed"] else "FAIL"
        cites = ", ".join(r["citations"]) or "none"
        print(f"[{status}] {r['id']} route={r['route']!s:<12} supported={r['supported']!s:<5} cites={cites}")
        if not r["passed"]:
            print(f"       expected ids={r['expected_ids']} supported={r['expected_supported']}")
            for leak in r["leaks"]:
                print(f"       LEAK {leak}")
            print(f"       answer={(r['answer'] or '')[:300]}")

    n_expected = sum(len(r["expected_ids"]) for r in rows)
    n_found = sum(len(r["found_ids"]) for r in rows)
    metrics: dict[str, float] = {
        "supported_accuracy": sum(r["supported_ok"] for r in rows) / len(rows),
        "expected_citation_recall": n_found / n_expected if n_expected else 1.0,
        "leaked_unverified_claims": sum(len(r["leaks"]) for r in rows),
    }
    failures = check_thresholds(metrics, thresholds)

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    out_file = RESULTS_DIR / f"{stamp}.json"
    out_file.write_text(
        json.dumps(
            {
                "timestamp": stamp,
                "llm_provider": get_llm_provider().name,
                "tracing": tracing,
                "n_questions": len(rows),
                "passed_questions": sum(r["passed"] for r in rows),
                "metrics": metrics,
                "thresholds": thresholds,
                "threshold_failures": failures,
                "items": rows,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"\nGolden set: {sum(r['passed'] for r in rows)}/{len(rows)} questions fully passed")
    for name, value in metrics.items():
        print(f"  {name:<26} {value:.3f}  (rule: {thresholds.get(name)})")
    print(f"Results: {out_file.relative_to(BACKEND_DIR)}")
    if failures:
        print("THRESHOLDS NOT MET: " + "; ".join(failures))
        return 1
    print("All thresholds met.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
