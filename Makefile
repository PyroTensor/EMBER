.PHONY: setup db-up db-down db-reset proxy ingest ingest-drill backend frontend test eval

setup:            ## install python (uv) + node deps
	uv sync
	cd frontend && npm install

db-up:            ## start Postgres + pgvector
	docker compose up -d --wait db

db-down:
	docker compose down

db-reset:         ## wipe the database volume and re-run schema.sql
	docker compose down -v
	docker compose up -d --wait db

proxy:            ## regenerate proxy data in contracts/mock_data
	uv run python contracts/generate_proxy_data.py

ingest: db-up     ## run the full offline ingestion pipeline on proxy data
	uv run python -m ember_data.ingestion.pipeline --source contracts/mock_data

ingest-drill: db-up  ## rehearse the Nov 14 swap with a deliberately messy CSV
	uv run python -m ember_data.ingestion.pipeline --source contracts/mock_data --runs-file raw_drop_example.csv --dry-run

backend:          ## FastAPI on :8000
	uv run uvicorn app.main:app --reload --port 8000 --app-dir backend

frontend:         ## Next.js on :3000
	cd frontend && npm run dev

test:
	uv run pytest data_ml/tests backend/tests -q

eval:
	uv run python backend/eval/run_eval.py
