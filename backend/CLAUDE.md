# EMBER backend — Claude Code instructions
Standalone uv project (Python 3.12, FastAPI, SQLAlchemy 2.0 async, Postgres 16 + pgvector, LangGraph).
Its only external agreement is `../contracts/openapi_v1.yaml`. Never import from `../frontend` or `../legacy`.
Full plan: `../plan_backend.md` (read only the section a step points to).

## Layer contract
| Layer | Responsibility | May import | Must NOT |
|---|---|---|---|
| `core/` | config, logging, errors, middleware, lifespan, constants | stdlib, pydantic-settings | import any other `app.*` layer |
| `db/` | engines, sessions, Base, availability probe | `core` | contain queries |
| `models/` | ORM table definitions (1 file = 1 table) | `db.base` | contain business logic |
| `schemas/` | Pydantic request/response/DTOs that mirror the OpenAPI contract | `core.constants`, `schemas.enums` | import models, repos or services |
| `repositories/` | **all** reads and writes to Postgres or the snapshot | `models`, `schemas`, `db` | apply business rules, raise HTTP errors |
| `domain/` | pure deterministic functions + frozen dataclasses | stdlib, numpy | do I/O, import pydantic, FastAPI or SQLAlchemy |
| `services/` | use cases: orchestrate repos + domain + rag, map to schemas, raise `AppError`s | everything below it | import FastAPI or write SQL |
| `rag/` | LangGraph graph + nodes | `schemas`, `domain`, `llm`, `embeddings`, repo **Protocols** | open DB sessions itself (gets them through `RagToolkit`) |
| `llm/`, `embeddings/` | provider abstractions, cached singletons | `core` | know about RAG or HTTP |
| `ingestion/` | offline 7-stage pipeline | `domain`, `schemas`, `repositories`, `embeddings`, `llm` | be imported by `api/` |
| `api/` | routers + dependency wiring | `services`, `schemas`, `api.deps` | contain logic beyond request/response mapping |

## Conventions
- Every module starts with `from __future__ import annotations`.
- Async everywhere on the request path (`async def` routers, services, repositories; `AsyncSession`).
  CPU-bound or blocking work (embedding, PDF parsing) goes through `anyio.to_thread.run_sync`.
- ORM models use SQLAlchemy 2.0 typed style: `Mapped[...]` + `mapped_column(...)`. Schema changes go through Alembic
  migrations only (no `create_all`, no `schema.sql`).
- Settings are read only via `app.core.config.get_settings()` (cached). Never read `os.environ` directly.
- Errors: services raise `AppError` subclasses (`NotFoundError`, `InvalidInputError`, `UpstreamUnavailableError`);
  `core/error_handlers.py` renders the `{"error": {code, message, details}}` envelope. No `HTTPException` in services.
- Routers stay thin: parse request schema → call service → return response schema.
- Line length 110; ruff rules E, F, I, B, UP, SIM, ASYNC. mypy strict on `domain`, `schemas`, `services`.
- No new dependencies unless the current step lists them.

## Make targets (run from `backend/`; on Windows use `mingw32-make` if `make` is missing)
| Target | Does |
|---|---|
| `setup` | `uv sync` |
| `db-up` / `db-down` / `db-reset` | start / stop / wipe+restart Postgres + pgvector (docker compose) |
| `migrate` | `alembic upgrade head` |
| `seed` | ingestion over `data/seed` → Postgres + `data/.cache/store.json` |
| `ingest-drill` | Nov 14 drill: messy `raw_drop_example.csv`, `--dry-run` |
| `dev` | `uvicorn app.main:app --reload --port 8000` (Swagger at `/docs`) |
| `lint` / `fmt` / `typecheck` | ruff check + format check / auto-fix + format / mypy |
| `openapi` / `contract-check` | export generated OpenAPI / diff it against `contracts/openapi_v1.yaml` |
| `test` / `test-int` | unit + api tests / testcontainers integration tests |
| `eval` | RAG golden-set evaluation |
