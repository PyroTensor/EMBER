# EMBER backend

FastAPI + Postgres 16/pgvector + LangGraph grounded RAG for microgravity combustion data.
Standalone [uv](https://docs.astral.sh/uv/) project (Python 3.12). Its only agreement with the frontend is
[`../contracts/openapi_v1.yaml`](../contracts/openapi_v1.yaml).

## Quick start

Prerequisites: Python 3.12, `uv`, Docker, GNU make (on Windows use `mingw32-make`).

```bash
cd backend
cp .env.example .env
make setup          # uv sync
make db-up          # Postgres + pgvector (docker compose)
make migrate        # alembic upgrade head
make seed           # ingestion on data/seed -> Postgres + data/.cache/store.json
make dev            # uvicorn app.main:app --reload --port 8000   (Swagger at http://localhost:8000/docs)
```

Check it works: `curl http://localhost:8000/api/health` should report `"status": "ok"` and `"db": true`.

Without Docker the API still runs: when Postgres is unreachable it falls back to the snapshot
`data/.cache/store.json` (built by `make seed`, or on first use).

### Other targets

| Target | Does |
|---|---|
| `make lint` / `make fmt` | ruff check + format check / auto-fix + format |
| `make typecheck` | mypy (strict on `domain`, `schemas`, `services`) |
| `make contract-check` | diff the served OpenAPI against `contracts/openapi_v1.yaml` |
| `make openapi` | export the generated OpenAPI |
| `make eval` | golden-set RAG evaluation in-process; exits 1 if `eval/thresholds.yaml` is not met |
| `make ingest-drill` | dry-run ingestion of the messy `raw_drop_example.csv` |
| `make test` / `make test-int` | unit + api tests / testcontainers integration tests |
| `make db-down` / `make db-reset` | stop Postgres / wipe the volume and restart |

### Docker image

```bash
docker build -t ember-backend backend                                   # from the repo root
docker build --build-arg PRELOAD_EMBED_MODEL=1 -t ember-backend backend # bake in the bge model
docker run --rm -p 8000:8000 --env-file backend/.env -e DB_HOST=host.docker.internal ember-backend
```

The image runs as a non-root user, has a `HEALTHCHECK` on `/api/health`, and reads all config from environment
variables (no `.env` is copied in). Run migrations from the image with `docker run ... ember-backend alembic upgrade head`.

## Configuration

Every variable maps 1:1 to a field of `app.core.config.Settings` (names are case-sensitive). `backend/.env` is
loaded first; real environment variables win.

| Variable | Default | Notes |
|---|---|---|
| `ENV` | `dev` | `dev` / `test` / `prod`. `prod` rejects placeholder DB passwords and `http://` CORS origins |
| `LOG_LEVEL` / `LOG_JSON` | `INFO` / `false` | JSON log lines for prod |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | **required** | also used by `docker-compose.yml` |
| `DB_RO_USER` / `DB_RO_PASSWORD` | `ember_ro` / `ember_ro` | read-only role (migration 0004) used by every read path |
| `DB_POOL_SIZE` / `DB_CONNECT_TIMEOUT_S` | `5` / `2` | |
| `DATA_BACKEND` | `auto` | `auto` (probe Postgres, else snapshot) / `postgres` / `snapshot` |
| `DB_PROBE_TTL_S` | `15` | how long the DB availability decision is cached |
| `SNAPSHOT_PATH` / `SEED_DIR` / `CACHE_DIR` | `data/.cache/store.json` / `data/seed` / `data/.cache` | relative to `backend/` |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | JSON list or CSV; never `*` |
| `LLM_PROVIDER` | `heuristic` | `heuristic` (no key) / `gemini` / `openai` |
| `LLM_MODEL` | `gemini-2.5-flash` | |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | empty | required for the matching provider |
| `EMBED_ENABLED` | `true` | `false` = keyword-only retrieval, no model download |
| `EMBED_MODEL` / `EMBED_DIM` | `BAAI/bge-small-en-v1.5` / `384` | changing the dimension needs a migration |
| `EMBED_WARMUP` | `true` | run the embedder once at startup |
| `RAG_TOP_K` / `RAG_MAX_REWRITES` / `RAG_ANSWER_EVIDENCE` | `5` / `2` / `8` | |
| `RAG_TIMEOUT_S` | `30` | `POST /api/copilot/ask` returns 504 `UPSTREAM_TIMEOUT` after this |
| `LANGSMITH_API_KEY` / `LANGSMITH_PROJECT` | empty / `ember` | optional tracing (sends questions and answers to LangSmith) |

## Layers

```
api/  ->  services/  ->  repositories/ + domain/ + rag/  ->  db/ + models/        (core/ is used by all)
```

| Layer | Responsibility |
|---|---|
| `core/` | config, logging, errors, middleware (request id, body size limit), lifespan, constants |
| `db/` | engines, sessions, `Base`, DB availability probe |
| `models/` | ORM tables (one file per table); schema changes only through Alembic |
| `schemas/` | Pydantic request/response models mirroring the OpenAPI contract |
| `repositories/` | all reads/writes to Postgres or the snapshot, behind Protocols in `interfaces.py` |
| `domain/` | pure deterministic functions (cabin risk, scenario ranking); no I/O |
| `services/` | use cases: orchestrate repositories + domain + RAG, raise `AppError`s |
| `rag/` | LangGraph graph and nodes; everything injected through `RagToolkit` |
| `llm/`, `embeddings/` | provider abstractions, cached singletons |
| `ingestion/` | offline 7-stage pipeline (`make seed`) |
| `api/` | thin routers + dependency wiring (`api/deps.py`) |

Full rules: [`CLAUDE.md`](CLAUDE.md) and `../plan_backend.md`.

## How to add an endpoint

1. **Contract first**: add the path and schemas to `contracts/openapi_v1.yaml` (agree it with the frontend).
2. **Schema**: add request/response models in `app/schemas/<area>.py` (subclass `APIModel`).
3. **Data access** (if needed): add a method to the Protocol in `app/repositories/interfaces.py` and implement
   it in both the Postgres repository and the snapshot repository.
4. **Logic**: pure calculations go in `app/domain/`; the use case goes in `app/services/<area>_service.py` and
   raises `NotFoundError` / `InvalidInputError` / `UpstreamUnavailableError` instead of HTTP errors.
5. **Wiring**: add `get_<area>_service` and an `Annotated` dependency in `app/api/deps.py` (use the read-only
   reader factories for reads).
6. **Router**: `app/api/routers/<area>.py` that only parses the request, calls the service and returns the
   response, with `responses=error_responses(...)`; register it in `app/api/router.py`.
7. **Verify**: `make lint typecheck contract-check`, then try it in Swagger at `/docs`.
