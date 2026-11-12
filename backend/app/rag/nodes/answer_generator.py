"""LangGraph Node - Answer generator: cites [DOC-XX p.Y] and [EXP-XXXX] per claim; 'no data' when missing."""

from __future__ import annotations

import re
from typing import Any

from app.core.constants import NO_DATA_MESSAGE
from app.rag.prompts import load_prompt
from app.rag.state import EvidenceItem, GraphState
from app.rag.toolkit import RagToolkit


def _clean_sentence(text: str) -> str:
    s = re.sub(r"\[DOC-\d+\s+p\.\d+\s*-\s*[^\]]*\]\s*", "", text)
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
        if s.startswith("|") or "PROXY DOCUMENT" in s:
            continue
        words = set(re.findall(r"[a-z0-9-]+", s.lower()))
        scored.append((len(words & q_terms), s))
    scored.sort(key=lambda t: t[0], reverse=True)
    return [s for _, s in scored[:max_sentences]]


def _synthesize_heuristic(question: str, evidence: list[EvidenceItem]) -> tuple[str, bool]:
    chunks = [e for e in evidence if e["kind"] == "chunk" and e.get("doc_id") and e.get("page")]
    runs = [e for e in evidence if e["kind"] in ("test_run", "ranked_run") and e.get("experiment_id")]

    if not chunks and not runs:
        return NO_DATA_MESSAGE, False

    claims: list[str] = []
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

    if tk.llm.name != "heuristic":
        context = "\n".join(f"- {e['text']}" for e in evidence[: tk.settings.RAG_ANSWER_EVIDENCE])
        ans = await tk.llm.complete(
            load_prompt("answer"), f"Question: {state['original_question']}\n\nEvidence:\n{context}"
        )
        if ans.lower().startswith("no data"):
            return {"answer": NO_DATA_MESSAGE, "supported": False}
        return {"answer": ans, "supported": True}

    ans, supported = _synthesize_heuristic(state.get("original_question") or state["question"], evidence)
    return {"answer": ans, "supported": supported}


__all__ = ["answer_generator_node"]
