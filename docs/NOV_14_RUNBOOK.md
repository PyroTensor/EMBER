# November 14 Official Data-Drop Runbook

When NASA releases the official Space Apps dataset on **November 14**, follow this exact 5-step checklist to ingest the official data without breaking the backend or frontend.

---

## Step 1: Stage Raw Files (`T+0 min`)
Copy the official CSV/JSON/PDF files into a folder (e.g., `contracts/official_drop/`):
```bash
mkdir -p contracts/official_drop/corpus
# copy official test matrices, telemetry, and NTRS PDFs into contracts/official_drop/
```

## Step 2: Map Headers in `column_map.yaml` (`T+5 min`)
Inspect the headers of the official CSV:
```bash
head -n 5 contracts/official_drop/<official_runs.csv>
```
Open [data_ml/ember_data/ingestion/adapters/column_map.yaml](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/data_ml/ember_data/ingestion/adapters/column_map.yaml) and add any new column names or unit tags (`psia`, `kpa`, `ft_min`, `cm_s`, `fraction`, `pct`, `w_cm2`, `kw_m2`) under the matching `schema_v1` field.
> [!TIP]
> **Do not worry about extra columns!** Any column not listed in `column_map.yaml` is automatically preserved inside `extra_telemetry` (`JSONB`) and rendered dynamically in the Module 3 UI inspector.

## Step 3: Dry-Run the Ingestion Pipeline (`T+10 min`)
Run a dry run first to verify unit conversions and check for rejected rows:
```bash
uv run python -m ember_data.ingestion.pipeline \
  --source contracts/official_drop \
  --runs-file <official_runs.csv> \
  --dry-run --skip-embed
```
Check [data_ml/review_queue.csv](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/data_ml/review_queue.csv) for any `REJECTED` rows or physics flags. If an enum alias is missing (e.g., a new material or regime spelling), add it under `aliases:` in `column_map.yaml`.

## Step 4: Full Ingest into Postgres + pgvector (`T+15 min`)
Once `0 rejected` is reported:
```bash
make db-up
uv run python -m ember_data.ingestion.pipeline \
  --source contracts/official_drop \
  --runs-file <official_runs.csv>
```
This populates `investigations`, `test_runs`, `telemetry`, and `chunks` (with 384-dim `bge-small` embeddings) in Postgres and updates `data_ml/.cache/store.json`.

## Step 5: Sync Frontend Mock Fallback & Run Smoke Tests (`T+20 min`)
If you also want the frontend's offline mock mode (`NEXT_PUBLIC_USE_MOCK_DATA=true`) to reflect the new data:
```bash
cd frontend && npm run sync-mocks
make test
make eval
```
Open `http://localhost:3000/ranking` and `http://localhost:3000/copilot` to confirm the new experiment IDs, `extra_telemetry` badges, and `[DOC-XX p.Y]` citations render live.
