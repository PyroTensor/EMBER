"""Database access layer for Postgres + pgvector (with automatic local snapshot fallback).

When `docker compose up -d db` is running, all queries execute against Postgres 16 + pgvector:
  - `sql_tool` uses the read-only role (`DATABASE_URL_READONLY`)
  - `hybrid_retriever` runs Postgres `ts_rank_cd` (BM25-style) + `pgvector` HNSW cosine distance

When Postgres is not reachable (e.g. local dev before starting Docker or CI), queries
transparently execute against `data_ml/.cache/store.json` (produced by `make ingest`) or
`contracts/mock_data/`, using the exact same schema and 384-dim bge-small embeddings.
"""
from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from typing import Any

import psycopg
from pgvector.psycopg import register_vector
from psycopg.rows import dict_row

from app.config import get_settings
from ember_data import MOCK_DATA_DIR
from ember_data.ingestion import chunk_embed, parse
from ember_data.ingestion.load_pg import LOCAL_STORE_PATH

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "does", "for", "from", "how", "in", "is",
    "it", "of", "on", "or", "that", "the", "to", "what", "when", "where", "which", "why", "with",
}


def _try_pg(readonly: bool = False) -> psycopg.Connection | None:
    s = get_settings()
    url = s.database_url_readonly if readonly else s.database_url
    try:
        conn = psycopg.connect(url, connect_timeout=1, row_factory=dict_row)
        register_vector(conn)
        return conn
    except Exception:
        if readonly:
            try:
                conn = psycopg.connect(s.database_url, connect_timeout=1, row_factory=dict_row)
                register_vector(conn)
                return conn
            except Exception:
                return None
        return None


@lru_cache(maxsize=1)
def _fallback_store() -> dict[str, Any]:
    if LOCAL_STORE_PATH.exists():
        return json.loads(LOCAL_STORE_PATH.read_text())

    # Build minimal in-memory snapshot directly from contracts/mock_data if ingest hasn't run yet
    runs = json.loads((MOCK_DATA_DIR / "experiments_proxy.json").read_text())
    tel = {d["experiment_id"]: d for d in json.loads((MOCK_DATA_DIR / "telemetry_proxy.json").read_text())}
    doc_paths = sorted((MOCK_DATA_DIR / "corpus").glob("*.md")) + sorted((MOCK_DATA_DIR / "iss_pages").glob("*.md"))
    docs = parse.parse_documents(doc_paths)
    chunks = [
        {
            "id": i + 1,
            "doc_id": c.doc_id,
            "page": c.page,
            "section": c.section,
            "text": c.text,
            "metadata": c.metadata,
            "embedding": None,
        }
        for i, c in enumerate(c for d in docs for c in chunk_embed.chunk_document(d))
    ]
    return {"investigations": [], "test_runs": runs, "telemetry": tel, "chunks": chunks}


def is_postgres_connected() -> bool:
    conn = _try_pg()
    if conn is None:
        return False
    conn.close()
    return True


def get_health_stats() -> dict[str, Any]:
    conn = _try_pg()
    if conn is not None:
        with conn, conn.cursor() as cur:
            cur.execute("SELECT count(*) AS n FROM test_runs")
            n_runs = cur.fetchone()["n"]
            cur.execute("SELECT count(*) AS n FROM chunks")
            n_chunks = cur.fetchone()["n"]
            cur.execute("SELECT DISTINCT jsonb_object_keys(extra_telemetry) AS k FROM test_runs ORDER BY k")
            keys = [r["k"] for r in cur.fetchall()]
        conn.close()
        return {"db": True, "test_runs": n_runs, "chunks": n_chunks, "extra_telemetry_keys": keys}

    store = _fallback_store()
    runs = store["test_runs"]
    keys = sorted({k for r in runs for k in (r.get("extra_telemetry") or {})})
    return {"db": False, "test_runs": len(runs), "chunks": len(store["chunks"]), "extra_telemetry_keys": keys}


def list_test_runs(
    program: str | None = None,
    fuel_material: str | None = None,
    combustion_regime: str | None = None,
    gravity_g: float | None = None,
    experiment_id: str | None = None,
    readonly: bool = False,
) -> list[dict[str, Any]]:
    conn = _try_pg(readonly=readonly)
    if conn is not None:
        clauses, params = [], []
        if experiment_id:
            clauses.append("experiment_id = %s"); params.append(experiment_id)
        if program:
            clauses.append("program = %s"); params.append(program)
        if fuel_material:
            clauses.append("fuel_material = %s"); params.append(fuel_material)
        if combustion_regime:
            clauses.append("combustion_regime = %s"); params.append(combustion_regime)
        if gravity_g is not None:
            clauses.append("abs(gravity_g - %s) < 0.01"); params.append(gravity_g)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        with conn, conn.cursor() as cur:
            cur.execute(f"SELECT * FROM test_runs {where} ORDER BY experiment_id", params)
            rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        for r in rows:
            r.pop("investigation_id", None)
            r.pop("review_flags", None)
        return rows

    rows = [dict(r) for r in _fallback_store()["test_runs"]]
    for r in rows:
        r.pop("investigation_id", None)
        r.pop("review_flags", None)
    if experiment_id:
        rows = [r for r in rows if r["experiment_id"] == experiment_id]
    if program:
        rows = [r for r in rows if r["program"].lower() == program.lower()]
    if fuel_material:
        rows = [r for r in rows if r["fuel_material"].lower() == fuel_material.lower()]
    if combustion_regime:
        rows = [r for r in rows if r["combustion_regime"].lower() == combustion_regime.lower()]
    if gravity_g is not None:
        rows = [r for r in rows if abs(float(r["gravity_g"]) - gravity_g) < 0.01]
    return rows


def get_telemetry(experiment_id: str) -> dict[str, Any] | None:
    conn = _try_pg()
    if conn is not None:
        with conn, conn.cursor() as cur:
            cur.execute("SELECT series FROM telemetry WHERE experiment_id = %s", (experiment_id,))
            row = cur.fetchone()
        conn.close()
        if row:
            return row["series"]
    return _fallback_store()["telemetry"].get(experiment_id)


def _tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9_.-]+", text.lower()) if len(t) > 1 and t not in STOPWORDS]


def _bm25_scores(query: str, chunks: list[dict[str, Any]]) -> dict[int, float]:
    q_terms = _tokens(query)
    if not q_terms or not chunks:
        return {}
    doc_tokens = [
        _tokens(f"{c.get('doc_id', '')} {c.get('section', '')} {c.get('metadata', {}).get('title', '')} {c['text']}")
        for c in chunks
    ]
    avgdl = sum(len(dt) for dt in doc_tokens) / max(len(doc_tokens), 1)
    n_docs = len(chunks)
    df = {t: sum(1 for dt in doc_tokens if t in dt) for t in set(q_terms)}
    k1, b = 1.5, 0.75
    scores: dict[int, float] = {}
    for c, dt in zip(chunks, doc_tokens):
        s = 0.0
        dl = len(dt) or 1
        for t in q_terms:
            tf = dt.count(t)
            if tf == 0:
                continue
            idf = math.log(1.0 + (n_docs - df[t] + 0.5) / (df[t] + 0.5))
            s += idf * (tf * (k1 + 1.0)) / (tf + k1 * (1.0 - b + b * dl / avgdl))
        if s > 0:
            scores[int(c["id"])] = s
    return scores


def hybrid_search_chunks(
    query: str,
    query_embedding: list[float] | None = None,
    top_k: int = 6,
    rrf_k: int = 60,
) -> list[dict[str, Any]]:
    """Hybrid BM25 + vector cosine search fused with Reciprocal Rank Fusion (RRF)."""
    conn = _try_pg(readonly=True)
    if conn is not None:
        with conn, conn.cursor() as cur:
            cur.execute(
                """SELECT id, doc_id, page, section, text, metadata,
                          ts_rank_cd(tsv, websearch_to_tsquery('english', %s)) AS bm25
                   FROM chunks
                   WHERE tsv @@ websearch_to_tsquery('english', %s)
                   ORDER BY bm25 DESC LIMIT 20""",
                (query, query),
            )
            bm25_rows = [dict(r) for r in cur.fetchall()]
            vec_rows: list[dict[str, Any]] = []
            if query_embedding is not None:
                cur.execute(
                    """SELECT id, doc_id, page, section, text, metadata,
                              1 - (embedding <=> %s::vector) AS cosine
                       FROM chunks
                       WHERE embedding IS NOT NULL
                       ORDER BY embedding <=> %s::vector LIMIT 20""",
                    (query_embedding, query_embedding),
                )
                vec_rows = [dict(r) for r in cur.fetchall()]
        conn.close()

        by_id: dict[int, dict[str, Any]] = {}
        rrf: dict[int, float] = {}
        for rank, r in enumerate(bm25_rows, start=1):
            cid = int(r["id"])
            by_id[cid] = r
            rrf[cid] = rrf.get(cid, 0.0) + 1.0 / (rrf_k + rank)
        for rank, r in enumerate(vec_rows, start=1):
            cid = int(r["id"])
            by_id.setdefault(cid, r).update({"cosine": r["cosine"]})
            rrf[cid] = rrf.get(cid, 0.0) + 1.0 / (rrf_k + rank)

        ranked_ids = sorted(rrf, key=lambda i: rrf[i], reverse=True)[:top_k]
        return [{**by_id[i], "rrf_score": round(rrf[i], 4)} for i in ranked_ids]

    # Fallback store: BM25 + cosine on stored 384-dim embeddings -> RRF
    chunks = _fallback_store()["chunks"]
    bm25 = _bm25_scores(query, chunks)
    bm25_ranked = sorted(bm25, key=lambda i: bm25[i], reverse=True)[:20]

    vec_scores: dict[int, float] = {}
    if query_embedding is not None:
        for c in chunks:
            emb = c.get("embedding")
            if emb:
                vec_scores[int(c["id"])] = sum(a * b for a, b in zip(query_embedding, emb))
    vec_ranked = sorted(vec_scores, key=lambda i: vec_scores[i], reverse=True)[:20]

    by_id = {int(c["id"]): c for c in chunks}
    rrf: dict[int, float] = {}
    for rank, cid in enumerate(bm25_ranked, start=1):
        rrf[cid] = rrf.get(cid, 0.0) + 1.0 / (rrf_k + rank)
    for rank, cid in enumerate(vec_ranked, start=1):
        rrf[cid] = rrf.get(cid, 0.0) + 1.0 / (rrf_k + rank)

    ranked_ids = sorted(rrf, key=lambda i: rrf[i], reverse=True)[:top_k]
    out = []
    for cid in ranked_ids:
        c = by_id[cid]
        out.append({
            "id": cid,
            "doc_id": c["doc_id"],
            "page": c["page"],
            "section": c.get("section", ""),
            "text": c["text"],
            "metadata": c.get("metadata", {}),
            "bm25": round(bm25.get(cid, 0.0), 4),
            "cosine": round(vec_scores.get(cid, 0.0), 4),
            "rrf_score": round(rrf[cid], 4),
        })
    return out
