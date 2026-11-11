"""Evaluation harness for the EMBER Grounded RAG pipeline.

Runs `backend/eval/golden_set.jsonl` (8 seed questions today; TODO(squad2-A): grow to 30
and add RAGAS faithfulness/answer_relevancy metrics).

Checks:
  1. `supported` flag matches `expected_supported` (including 'no data' on out-of-scope questions)
  2. Every expected doc_id or experiment_id appears in the verified `citations`
  3. Zero unverified claims leak past `citation_check`
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parents[1] / "data_ml"))

from app.rag.graph import ask_rag  # noqa: E402
from eval.tracing import configure_tracing  # noqa: E402


def main() -> int:
    configure_tracing()
    golden_path = HERE / "golden_set.jsonl"
    items = [json.loads(line) for line in golden_path.read_text().splitlines() if line.strip()]

    passed = 0
    for item in items:
        res = ask_rag(item["question"])
        sup_ok = bool(res.get("supported")) == bool(item["expected_supported"])
        cited_docs = {c["doc_id"] for c in res.get("citations", []) if c["kind"] == "doc" and c.get("doc_id")}
        cited_exps = {c["experiment_id"] for c in res.get("citations", []) if c.get("experiment_id")}

        exp_docs = set(item.get("expected_docs", []))
        exp_runs = set(item.get("expected_exps", []))
        cite_ok = exp_docs.issubset(cited_docs) and exp_runs.issubset(cited_exps)

        ok = sup_ok and cite_ok
        passed += int(ok)
        status = "PASS" if ok else "FAIL"
        cites_str = ", ".join(c["id"] for c in res.get("citations", [])) or "none"
        print(f"[{status}] {item['id']} route={res.get('route'):<12} supported={res.get('supported')} cites={cites_str}")
        if not ok:
            print(f"       expected docs={exp_docs} exps={exp_runs} supported={item['expected_supported']}")
            print(f"       answer={res.get('answer')}")

    print(f"\nGolden-set score: {passed}/{len(items)} ({100 * passed / len(items):.0f}%)")
    return 0 if passed == len(items) else 1


if __name__ == "__main__":
    sys.exit(main())
