# Team Onboarding

Welcome to **EMBER**. The repo holds two independent apps, `backend/` and `frontend/`, that agree only through the
API contract in `contracts/`. Neither imports code from the other.

---

## 1. Prerequisites
- **Python 3.12** + [`uv`](https://docs.astral.sh/uv/)
- **Node.js 22** + `npm`
- **Docker Desktop** (Postgres 16 + pgvector; also runs the whole stack with `make up`)
- Windows: use `mingw32-make` where these docs say `make`, or run the underlying commands directly.

## 2. First-time setup

```bash
git clone git@github.com:PyroTensor/EMBER.git
cd EMBER
```

**Whole stack in Docker** (fastest way to see it working):
```bash
make up                         # http://localhost:3000 (UI) · http://localhost:8000/docs (API)
make down
```

**Backend for development:**
```bash
cd backend
cp .env.example .env            # DB credentials, LLM provider (heuristic needs no key), CORS origins
make setup                      # uv sync
make db-up && make migrate      # Postgres + pgvector, schema via Alembic
make seed                       # ingest data/seed → Postgres + data/.cache/store.json
make dev                        # :8000 with reload
```
If Postgres is down, the API falls back to the local snapshot `data/.cache/store.json`, so you can keep working.

**Frontend for development:**
```bash
cd frontend
cp .env.example .env.local      # mock mode: MSW answers every /api call in the browser
npm install
npm run dev                     # :3000
```
To use your local backend instead, set `NEXT_PUBLIC_API_MODE=live` and `NEXT_PUBLIC_API_URL=http://localhost:8000`
in `.env.local` and restart `npm run dev`.

---

## 3. Where things live

| Area | Path | Notes |
|---|---|---|
| API contract | `contracts/openapi_v1.yaml`, `contracts/schema_v1.json` | change only via a contract PR (section 5) |
| HTTP routes | `backend/app/api/routers/` | thin: parse request → call service → return schema |
| Use cases | `backend/app/services/` | orchestrate repositories, domain logic and RAG |
| Domain math | `backend/app/domain/` | combustion physics, fire-risk + Shapley, scenario ranker |
| Database | `backend/app/models/`, `backend/alembic/` | schema changes only through Alembic migrations |
| RAG graph | `backend/app/rag/` | LangGraph nodes, citation check |
| Ingestion | `backend/app/ingestion/` | 7-stage offline pipeline, `adapters/column_map.yaml` |
| Evaluation | `backend/eval/` | golden set + thresholds |
| UI routes | `frontend/src/app/` | one page per route, renders one feature view |
| UI features | `frontend/src/features/<name>/` | api, hooks, components per module |
| Mocks | `frontend/src/mocks/` | MSW handlers + TypeScript port of the domain engine |

Each app's README covers its commands and conventions: [backend/README.md](../backend/README.md),
[frontend/README.md](../frontend/README.md).

---

## 4. Daily workflow
1. Branch from `main` (`git switch -c <feature>`), one change per branch.
2. Keep the app you touch green:
   - backend: `make lint && make typecheck && make contract-check && make eval`
   - frontend: `npm run lint && npm run typecheck && npm run build`
3. Commit messages: `feat(be): …`, `feat(fe): …`, `fix: …`, `chore: …`.
4. Open a PR into `main`. CI runs the backend and/or frontend workflow depending on the paths you changed.

## 5. Changing the contract
The contract is shared, so change it deliberately:
1. Edit `contracts/openapi_v1.yaml` (and `examples/` if a response shape changes) and add a
   `contracts/CHANGELOG.md` entry.
2. Backend: update `app/schemas/` until `make contract-check` prints `✓ app matches openapi_v1.yaml`.
3. Frontend: `npm run gen:api`, fix TypeScript errors, update the MSW handlers.
4. Both app owners review the PR.
