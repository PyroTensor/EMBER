# EMBER backend. Run from backend/. On Windows without GNU make, use `mingw32-make <target>`.
.PHONY: setup db-up db-down db-reset migrate seed seed-proxy ingest-drill ingest-llm dev lint fmt typecheck openapi contract-check test test-int eval

# Ingestion inputs. data/seed is an EMPTY drop folder for real data (put the official drop there, or pass
# SRC=<dir>). RUNS is optional: without it every run CSV in SRC is loaded.
#   mingw32-make seed SRC=data/official_drop RUNS=official_runs.csv
# The synthetic proxy dataset lives in tests/fixtures/proxy (tests, CI, eval, demo): `make seed-proxy`.
SRC ?= data/seed
RUNS ?=
PROXY := tests/fixtures/proxy
RUNS_ARG = $(if $(RUNS),--runs-file $(RUNS),)

setup: ; uv sync
db-up: ; docker compose up -d --wait db
db-down: ; docker compose down
db-reset: ; docker compose down -v && docker compose up -d --wait db
migrate: ; uv run alembic upgrade head
seed: ; uv run python -m app.ingestion --source $(SRC) $(RUNS_ARG)
seed-proxy: ; uv run python -m app.ingestion --source $(PROXY)
ingest-drill: ; uv run python -m app.ingestion --source $(PROXY) --runs-file raw_drop_example.csv --dry-run
# ingest-llm: LLM extraction dry run (PAID calls; needs OPENAI_API_KEY and/or GEMINI_API_KEY).
ingest-llm: ; uv run python -m app.ingestion --source $(SRC) $(RUNS_ARG) --extractor llm --dry-run --skip-embed
dev: ; uv run uvicorn app.main:app --reload --port 8000
lint: ; uv run ruff check . && uv run ruff format --check .
fmt: ; uv run ruff check --fix . && uv run ruff format .
typecheck: ; uv run mypy app
openapi: ; uv run python scripts/export_openapi.py
contract-check: ; uv run python scripts/check_contract.py
test: ; uv run pytest -m "not integration"
test-int: ; uv run pytest -m integration
eval: ; uv run python eval/run_eval.py
