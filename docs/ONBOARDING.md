# 6-Person Team Onboarding Guide

Welcome to **EMBER**! Our 6-person team is organized into **3 squads of 2**, with strict contract boundaries in `contracts/` so nobody blocks another squad.

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

## 3. Squad Ownership & Branching Rules

| Squad | Directory | Teammate Track A | Teammate Track B |
|---|---|---|---|
| **Squad 1 (Data & ML)** | `data_ml/` | **S1-A**: Ingestion adapters, PDF/Docling parsing, Gemini structured extraction | **S1-B**: Combustion physics calibration, 2D phase grid, surrogate risk & ranker |
| **Squad 2 (Backend & RAG)** | `backend/` | **S2-A**: LangGraph nodes, cross-encoder reranker, text-to-SQL guardrails, 30-Q RAGAS eval | **S2-B**: FastAPI endpoints, NASA-STD-6001B Compliance Brief generator, caching |
| **Squad 3 (Frontend UI)** | `frontend/` | **S3-A**: Module 1 (Cabin Configurator + Plotly Phase Diagram) & Module 3 (Ranking + 3-Panel Telemetry) | **S3-B**: Module 2 (1G vs 0G Flame Digital Twin Canvas) & Module 4 (SI Co-Pilot UX + Brief Export) |

### Git Workflow
1. Create a feature branch prefixed by your squad track:
   ```bash
   git checkout -b squad1-a/pdf-docling-parser
   git checkout -b squad2-a/cross-encoder-reranker
   git checkout -b squad3-b/flame-digital-twin-canvas
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
