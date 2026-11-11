"""Stage 7 - Load into Postgres + pgvector (investigations, test_runs, telemetry, chunks).

Idempotent: re-running the pipeline upserts runs and replaces chunks per doc_id.
Also writes a local snapshot (`data_ml/.cache/store.json`) so local tests and teammates
without Docker running can still query the exact same ingested records and embeddings.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import psycopg
from pgvector.psycopg import register_vector
from psycopg.types.json import Jsonb

from ember_data.ingestion.fetch_cache import CACHE_DIR
from ember_data.schema import Chunk, Investigation, TestRun

LOCAL_STORE_PATH = CACHE_DIR / "store.json"

RUN_COLS = [
    "experiment_id", "investigation_id", "program", "fuel_material", "fuel_geometry", "gravity_g", "oxygen_pct",
    "pressure_kpa", "flow_velocity_cm_s", "diluent_gas", "combustion_regime", "spread_or_burn_rate",
    "peak_radiative_flux_kw_m2", "limiting_oxygen_index_pct", "burn_duration_s", "source_doc_id", "source_page",
    "extra_telemetry", "review_flags",
]


def connect(url: str | None = None, timeout: int = 3) -> psycopg.Connection:
    conn = psycopg.connect(
        url or os.getenv("DATABASE_URL", "postgresql://ember:ember@localhost:5432/ember"),
        connect_timeout=timeout,
    )
    register_vector(conn)
    return conn


def save_local_snapshot(
    investigations: list[Investigation],
    runs: list[TestRun],
    flags: dict[str, list[str]],
    telemetry: dict[str, dict],
    chunks: list[Chunk],
    path: Path = LOCAL_STORE_PATH,
) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    known_inv = {i.id for i in investigations}
    run_dicts = []
    for r in runs:
        d = r.model_dump()
        d["investigation_id"] = r.program if r.program in known_inv else None
        d["review_flags"] = flags.get(r.experiment_id, [])
        run_dicts.append(d)

    payload = {
        "investigations": [i.model_dump() for i in investigations],
        "test_runs": run_dicts,
        "telemetry": {k: v for k, v in telemetry.items() if any(r.experiment_id == k for r in runs)},
        "chunks": [
            {
                "id": idx + 1,
                "doc_id": c.doc_id,
                "page": c.page,
                "section": c.section,
                "text": c.text,
                "metadata": c.metadata,
                "embedding": c.embedding,
            }
            for idx, c in enumerate(chunks)
        ],
    }
    path.write_text(json.dumps(payload))
    return path


def load_investigations(conn: psycopg.Connection, items: list[Investigation]) -> int:
    with conn.cursor() as cur:
        for inv in items:
            cur.execute(
                """INSERT INTO investigations (id, program, title, summary, source_doc_id)
                   VALUES (%s,%s,%s,%s,%s)
                   ON CONFLICT (id) DO UPDATE SET program=EXCLUDED.program, title=EXCLUDED.title,
                       summary=EXCLUDED.summary, source_doc_id=EXCLUDED.source_doc_id""",
                (inv.id, inv.program, inv.title, inv.summary, inv.source_doc_id),
            )
    return len(items)


def load_test_runs(conn: psycopg.Connection, runs: list[TestRun], flags: dict[str, list[str]],
                   known_investigations: set[str]) -> int:
    placeholders = ",".join(["%s"] * len(RUN_COLS))
    updates = ",".join(f"{c}=EXCLUDED.{c}" for c in RUN_COLS[1:])
    sql = f"INSERT INTO test_runs ({','.join(RUN_COLS)}) VALUES ({placeholders}) ON CONFLICT (experiment_id) DO UPDATE SET {updates}"
    with conn.cursor() as cur:
        for r in runs:
            d = r.model_dump()
            d["investigation_id"] = r.program if r.program in known_investigations else None
            d["extra_telemetry"] = Jsonb(d["extra_telemetry"])
            d["review_flags"] = flags.get(r.experiment_id, [])
            cur.execute(sql, [d[c] for c in RUN_COLS])
    return len(runs)


def load_telemetry(conn: psycopg.Connection, series: dict[str, dict], valid_ids: set[str]) -> int:
    n = 0
    with conn.cursor() as cur:
        for eid, s in series.items():
            if eid not in valid_ids:
                continue
            cur.execute(
                "INSERT INTO telemetry (experiment_id, series) VALUES (%s,%s) "
                "ON CONFLICT (experiment_id) DO UPDATE SET series=EXCLUDED.series",
                (eid, Jsonb(s)),
            )
            n += 1
    return n


def load_chunks(conn: psycopg.Connection, chunks: list[Chunk]) -> int:
    with conn.cursor() as cur:
        for doc_id in {c.doc_id for c in chunks}:
            cur.execute("DELETE FROM chunks WHERE doc_id = %s", (doc_id,))
        for c in chunks:
            cur.execute(
                "INSERT INTO chunks (doc_id, page, section, text, metadata, embedding) VALUES (%s,%s,%s,%s,%s,%s)",
                (c.doc_id, c.page, c.section, c.text, Jsonb(json.loads(json.dumps(c.metadata, default=str))),
                 c.embedding),
            )
    return len(chunks)
