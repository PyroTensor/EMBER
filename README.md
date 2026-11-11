# EMBER – Exploration of Microgravity Burning through Experimental Research
**2026 NASA Space Apps Challenge: *"Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data"***

EMBER is a 3-squad monorepo built by a 6-person team to evaluate spacecraft material flammability, rank microgravity combustion experiments (`BASS-II`, `SoFIE`, `FLEX`, `ACME`), and synthesize citation-checked fire-safety insights using a hybrid **Postgres + pgvector + LangGraph** RAG pipeline.

---

## Monorepo Layout (3 Squads, 6 Teammates)

```
EMBER/
├── contracts/          # Shared JSON Schema (schema_v1.json), OpenAPI spec & NASA proxy data
│   ├── schema_v1.json
│   ├── openapi_v1.yaml
│   ├── generate_proxy_data.py
│   └── mock_data/      # 50 proxy runs, telemetry curves, 5 NTRS docs, 4 ISS pages, Nov 14 drill CSV
├── data_ml/            # Squad 1: Offline 7-stage ingestion pipeline, physics, risk & scenario ranker
│   ├── ember_data/
│   │   ├── ingestion/  # fetch_cache -> parse -> normalize -> llm_extract -> validate -> chunk_embed -> load_pg
│   │   ├── physics/    # LOI, buoyant & forced effective velocity calculators
│   │   ├── models/     # Spacecraft Fire Risk Index (0-100) + exact Shapley attributions
│   │   └── ranking/    # Multi-factor Scenario Ranker (Similarity, Completeness, Criticality)
│   └── tests/
├── backend/            # Squad 2: FastAPI + Postgres/pgvector + LangGraph Grounded RAG
│   ├── app/
│   │   ├── db/         # schema.sql + psycopg/pgvector store (with automatic offline snapshot fallback)
│   │   ├── llm/        # Provider-agnostic LLM interface (Gemini default + zero-key Heuristic fallback)
│   │   ├── rag/        # LangGraph state machine & nodes (router, sql_tool, hybrid_retriever, etc.)
│   │   └── api/        # REST endpoints (/api/health, /api/presets, /api/evaluate-cabin, /api/copilot/ask)
│   ├── eval/           # Golden-set RAG evaluation harness + optional LangSmith tracing
│   └── tests/
├── frontend/           # Squad 3: Next.js + TypeScript + Tailwind "NASA Mission Control" dashboard
│   └── src/            # 4 core modules + NEXT_PUBLIC_USE_MOCK_DATA / live UI toggle
└── docs/               # Architecture, 6-person onboarding, squad backlog & Nov 14 data-drop runbook
```

---

## Quickstart (All Squads)

### 1. Install Dependencies
```bash
cp .env.example .env
make setup          # runs `uv sync` (Python workspace) and `cd frontend && npm install`
```

### 2. Start Postgres + pgvector & Run the Ingestion Pipeline
```bash
make db-up          # starts pgvector/pgvector:pg16 on :5432 and applies backend/app/db/schema.sql
make ingest         # runs all 7 ingestion stages on contracts/mock_data -> Postgres + local snapshot
```
*(Note: If Docker Desktop is not running yet, `make ingest` and `make backend` automatically save and query a local snapshot at `data_ml/.cache/store.json` so you are never blocked.)*

### 3. Run Backend & Frontend
In two terminals:
```bash
make backend        # FastAPI on http://localhost:8000 (Swagger docs at /docs)
make frontend       # Next.js Mission Control UI on http://localhost:3000
```

---

## Running Each Squad Independently

### Squad 1 (`data_ml/`)
```bash
# Regenerate proxy dataset and validate against contracts/schema_v1.json
make proxy

# Run the 7-stage ingestion pipeline
uv run python -m ember_data.ingestion.pipeline --source contracts/mock_data

# Rehearse the Nov 14 data drop with a messy CSV (psia, ft/min, extra columns)
make ingest-drill
```

### Squad 2 (`backend/`)
```bash
# Run pytest suite (data_ml + backend API + citation check)
make test

# Run the Grounded RAG golden-set evaluation harness
make eval
```

### Squad 3 (`frontend/`)
Squad 3 can work against the live FastAPI server (`http://localhost:8000`) **or** completely standalone using the built-in client-side mock engine:
```bash
cd frontend
npm run sync-mocks                           # copies contracts/mock_data/*.json into src/mock/
NEXT_PUBLIC_USE_MOCK_DATA=true npm run dev   # or flip the LIVE / MOCK switch in the top header bar
```

---

## Pre-Created Team Branches (6 Teammates / 3 Squads)

| Squad | Squad Branch | Teammate Track A Branch | Teammate Track B Branch |
|---|---|---|---|
| **Squad 1 (`data_ml/`)** | `squad1/data-ml` | `squad1-a/ingestion-extraction` | `squad1-b/physics-models-ranking` |
| **Squad 2 (`backend/`)** | `squad2/backend-rag` | `squad2-a/rag-reranker-eval` | `squad2-b/api-compliance-brief` |
| **Squad 3 (`frontend/`)** | `squad3/frontend-ui` | `squad3-a/cabin-ranking-charts` | `squad3-b/twin-copilot-ux` |

```bash
git fetch origin
git switch <your-branch-name>
```

---

## Documentation
- [docs/ARCHITECTURE.md](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/docs/ARCHITECTURE.md) — Data & RAG architecture diagram, node-by-node mapping, and contract rules.
- [docs/ONBOARDING.md](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/docs/ONBOARDING.md) — Setup guide and Git workflow for our 6-person team.
- [docs/BACKLOG.md](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/docs/BACKLOG.md) — Prioritized `TODO(squadN)` tasks split into 6 individual tracks (2 per squad).
- [docs/NOV_14_RUNBOOK.md](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/docs/NOV_14_RUNBOOK.md) — Step-by-step checklist for swapping in the official NASA dataset on November 14.
