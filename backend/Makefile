# EMBER backend. Run from backend/. On Windows without GNU make, use `mingw32-make <target>`.
.PHONY: setup db-up db-down db-reset migrate seed ingest-drill dev lint fmt typecheck openapi contract-check test test-int eval

setup: ; uv sync
db-up: ; docker compose up -d --wait db
db-down: ; docker compose down
db-reset: ; docker compose down -v && docker compose up -d --wait db
migrate: ; uv run alembic upgrade head
seed: ; uv run python -m app.ingestion --source data/seed
ingest-drill: ; uv run python -m app.ingestion --source data/seed --runs-file raw_drop_example.csv --dry-run
dev: ; uv run uvicorn app.main:app --reload --port 8000
lint: ; uv run ruff check . && uv run ruff format --check .
fmt: ; uv run ruff check --fix . && uv run ruff format .
typecheck: ; uv run mypy app
openapi: ; uv run python scripts/export_openapi.py
contract-check: ; uv run python scripts/check_contract.py
test: ; uv run pytest -m "not integration"
test-int: ; uv run pytest -m integration
eval: ; uv run python eval/run_eval.py
