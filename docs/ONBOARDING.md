# 6-Person Team Onboarding & Branching Guide

Welcome to **EMBER**! Our 6-person team is organized into **3 squads of 2**, with strict contract boundaries in `contracts/` and non-overlapping file ownership so all 6 teammates can work in parallel without merge conflicts.

---

## 1. Prerequisites (Mac / Linux / WSL)
- **Python 3.11+** + [`uv`](https://docs.astral.sh/uv/) (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- **Node.js 20+** + `npm`
- **Docker Desktop** (for Postgres 16 + `pgvector`; optional during initial local coding thanks to our snapshot fallback)

## 2. First-Time Setup (5 Minutes)
```bash
git clone git@github.com:PyroTensor/EMBER.git
cd EMBER
cp .env.example .env
make setup
make ingest
make test
```

---

## 3. Pre-Created Remote Branches (Zero-Conflict Ownership)

All squad integration branches and individual teammate branches are already created on `origin`. Check out your assigned branch after cloning:

### Individual Teammate Branches (6 Tracks)
| Teammate | Remote Branch | Owned Files (Conflict-Free Scope) |
|---|---|---|
| **Squad 1 — Track A** (Ingestion & Extraction) | `squad1-a/ingestion-extraction` | `data_ml/ember_data/ingestion/` (`fetch_cache.py`, `parse.py`, `normalize.py`, `llm_extract.py`, `adapters/column_map.yaml`) |
| **Squad 1 — Track B** (Physics, Risk & Ranking) | `squad1-b/physics-models-ranking` | `data_ml/ember_data/physics/combustion.py`, `data_ml/ember_data/models/risk.py`, `data_ml/ember_data/ranking/scenario_ranker.py` |
| **Squad 2 — Track A** (LangGraph RAG & Eval) | `squad2-a/rag-reranker-eval` | `backend/app/rag/` (`nodes/*`, `graph.py`), `backend/app/llm/provider.py`, `backend/eval/` |
| **Squad 2 — Track B** (FastAPI & Compliance Brief) | `squad2-b/api-compliance-brief` | `backend/app/api/` (`routes_cabin.py`, `routes_copilot.py`, `routes_experiments.py`, `routes_health.py`), `backend/app/db/` |
| **Squad 3 — Track A** (Modules 1 & 3 Charts) | `squad3-a/cabin-ranking-charts` | `frontend/src/app/cabin/page.tsx`, `frontend/src/app/ranking/page.tsx` |
| **Squad 3 — Track B** (Modules 2 & 4 Twin/Co-Pilot) | `squad3-b/twin-copilot-ux` | `frontend/src/app/twin/page.tsx`, `frontend/src/app/copilot/page.tsx` |

### Squad Integration Branches (3 Squads)
- `squad1/data-ml` — Integration branch for `squad1-a/*` and `squad1-b/*`
- `squad2/backend-rag` — Integration branch for `squad2-a/*` and `squad2-b/*`
- `squad3/frontend-ui` — Integration branch for `squad3-a/*` and `squad3-b/*`

---

## 4. Git Workflow
1. Switch to your pre-created remote branch:
   ```bash
   git fetch origin
   git switch squad1-a/ingestion-extraction   # replace with your assigned branch from the table above
   ```
2. **Never modify `contracts/schema_v1.json` or `contracts/openapi_v1.yaml` without announcing in the team channel** and running:
   ```bash
   make test
   cd frontend && npm run sync-mocks && npm run build
   ```
3. Before opening a PR into your squad branch or `main`, ensure:
   - `make test` passes (`10/10` unit & integration tests)
   - `make eval` passes (`8/8` golden-set questions)
   - `cd frontend && npm run build` passes
