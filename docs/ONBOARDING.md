# Team Onboarding & Branching Guide

Welcome to **EMBER**! Our repository is organized around shared contracts in `contracts/` and four focused working branches (`data-ml`, `backend`, `ai-agent`, and `frontend`) alongside `main`.

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

## 3. Repository Branches

All working branches are pre-created on `origin`:

| Branch | Directory / Scope | Responsibilities |
|---|---|---|
| `main` | Full monorepo | Stable integration branch |
| `data-ml` | `data_ml/` | 7-stage ingestion pipeline, unit normalization, physics calculators, Shapley risk model, and scenario ranker |
| `backend` | `backend/app/api/`, `backend/app/db/` | FastAPI REST endpoints, Postgres + `pgvector` database layer, and compliance brief generation |
| `ai-agent` | `backend/app/rag/`, `backend/app/llm/`, `backend/eval/` | LangGraph RAG nodes (`router`, `sql_tool`, `hybrid_retriever`, `evidence_grader`, `citation_check`), LLM providers, and golden-set evaluation |
| `frontend` | `frontend/` | Next.js dark-mode console (`/cabin`, `/twin`, `/ranking`, `/copilot`) and mock-mode fallback |

---

## 4. Git Workflow
1. Switch to your branch:
   ```bash
   git fetch origin
   git switch data-ml    # or: backend | ai-agent | frontend
   ```
2. **Never modify `contracts/schema_v1.json` or `contracts/openapi_v1.yaml` without announcing in the team channel** and running:
   ```bash
   make test
   cd frontend && npm run sync-mocks && npm run build
   ```
3. Before opening a PR into `main`, ensure:
   - `make test` passes (`10/10` unit & integration tests)
   - `make eval` passes (`8/8` golden-set questions)
   - `cd frontend && npm run build` passes
