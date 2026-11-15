# EMBER: Exploration of Microgravity Burning through Experimental Research
**2026 NASA Space Apps Challenge: *"Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data"***

EMBER evaluates spacecraft material flammability, ranks microgravity combustion experiments (`BASS-II`, `SoFIE`,
`FLEX`, `ACME`) against a habitat scenario, and answers fire-safety questions with citation-checked answers from a
**Postgres + pgvector + LangGraph** RAG pipeline.

| Module | Route | What it answers |
|---|---|---|
| Cabin Configurator | `/cabin` | 0–100 fire-risk index, LOI, predicted regime and exact Shapley drivers for a cabin atmosphere |
| Flame Twin | `/twin` | WebGL2 volumetric flame: 1 g buoyant plume vs 0 g spherical flame, ventilation paradox |
| Ranking & Telemetry | `/ranking` | NASA test runs most relevant to a scenario, score breakdown and telemetry |
| SI Co-Pilot | `/copilot` | Grounded Q&A where every sentence cites a `[DOC-XX p.Y]` page or an `[EXP-XXXX]` run |
| Live Telemetry | `/live-telemetry` | Streaming cabin and rig sensors, real-time fire-risk & Shapley drivers, closest NASA test runs, and in-browser simulator |

---

## Repository layout

Two independent apps that share only a data contract:

```
EMBER/
├── contracts/            # the API contract both apps follow (data only, no code)
│   ├── openapi_v1.yaml   # REST contract: 7 endpoints + ErrorResponse
│   ├── schema_v1.json    # one row = one combustion test run
│   ├── examples/         # one example response per endpoint (frontend mocks, backend checks)
│   ├── fixtures/         # domain_parity.json: inputs → expected risk / Shapley / top-5 ranking
│   └── CHANGELOG.md      # every contract change, with date and reason
├── backend/              # FastAPI + SQLAlchemy (async) + Postgres/pgvector + LangGraph (uv project)
├── frontend/             # Next.js 16 + React 19 + Tailwind 4 + TypeScript (npm project)
├── docs/                 # architecture, onboarding, backlog, Nov 14 data-drop runbook
├── docker-compose.yml    # integration stack: db + backend + frontend
└── Makefile              # up / down + pass-through to backend/ and frontend/
```

Each app has its own README with full details: [backend/README.md](backend/README.md),
[frontend/README.md](frontend/README.md).

---

## Quickstart: whole stack in Docker

```bash
make up        # docker compose up --build → UI http://localhost:3000 · API http://localhost:8000/docs
make down      # stop it (database and model-cache volumes are kept)
```

The backend container migrates the database, seeds the proxy dataset (50 runs, 35 document chunks) and starts the API.
The frontend runs in live mode against it. On Windows, use `mingw32-make` if `make` is missing.

## Local development

### Live telemetry & simulators

Open `/live-telemetry` to stream and monitor cabin room atmosphere and combustion rig data in real time:
- **In-browser simulator:** Use the **Browser Telemetry Simulator** card on `/live-telemetry` to play, pause, loop, step frame-by-frame, or hand-tune live cabin presets and sliders in both `mock` and `live` API modes.
- **Standalone Python feeder:** `simulate_live_telemetry.py` at the repository root (excluded from Docker images via `.dockerignore`) streams synthetic scenarios using only the Python 3 standard library:

```bash
python3 simulate_live_telemetry.py --scenario sofie-ramp
python3 simulate_live_telemetry.py --scenario eva-prebreathe --interval 1.0
python3 simulate_live_telemetry.py --scenario ventilation-paradox --steps 45 --loop
python3 simulate_live_telemetry.py --scenario apollo-incident --url http://localhost:8000
python3 simulate_live_telemetry.py --scenario cool-flame-drop --steps 45
```

If no backend is listening at `--url`, `simulate_live_telemetry.py` starts a lightweight local fallback HTTP server on that port. When running the full backend (`http://localhost:8000`), frames are evaluated against the backend's current dataset (`POST /api/live-telemetry`) and retain the latest 120 samples in memory (streams without a frame for 30 s are marked stale).

### Starting the apps

**Backend** (Python 3.12 + [uv](https://docs.astral.sh/uv/), Docker for Postgres):
```bash
cd backend
cp .env.example .env
make setup && make db-up && make migrate && make seed-proxy   # synthetic demo data; real drops: see docs/INGESTION_GUIDE.md
make dev                      # http://localhost:8000 (Swagger at /docs)
```

**Frontend** (Node.js 22): runs on mocks by default, no backend needed:
```bash
cd frontend
cp .env.example .env.local    # NEXT_PUBLIC_API_MODE=mock; set live + NEXT_PUBLIC_API_URL to use the backend
npm install
npm run dev                   # http://localhost:3000
```

From the repo root, `make backend-<target>` runs a backend make target and `make frontend-<script>` runs an npm
script, e.g. `make backend-eval` or `make frontend-lint`.

## Quality gates (also run in CI)

| App | Command | Checks |
|---|---|---|
| backend | `make lint`, `make typecheck` | ruff, mypy |
| backend | `make contract-check` | two-way diff of the served OpenAPI against `contracts/openapi_v1.yaml` |
| backend | `make eval` | 30-question golden set: supported accuracy, citation recall, zero unverified claims |
| frontend | `npm run lint`, `npm run typecheck`, `npm run build` | ESLint (incl. import boundaries), tsc, production build |
| frontend | `npm run gen:api` + `git diff` | generated API types match the contract |

## Changing the contract

Edit `contracts/openapi_v1.yaml` in its own PR, add a `contracts/CHANGELOG.md` entry, then make
`make contract-check` (backend) and `npm run gen:api && npm run typecheck` (frontend) pass. See
[contracts/README.md](contracts/README.md).

---

## Documentation
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): system and RAG architecture, diagram-to-code map.
- [docs/ONBOARDING.md](docs/ONBOARDING.md): setup, daily workflow and pull-request checklist.
- [docs/BACKLOG.md](docs/BACKLOG.md): open feature work by track.
- [docs/NOV_14_RUNBOOK.md](docs/NOV_14_RUNBOOK.md): swapping in the official NASA dataset.
