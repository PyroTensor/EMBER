# November 14 Official Data-Drop Runbook

When NASA releases the official Space Apps dataset on **November 14**, follow these 5 steps to ingest it without
breaking the backend or the frontend. All commands run from `backend/` (Windows: `mingw32-make` for `make`).

The ingestion CLI is `uv run python -m app.ingestion` with these flags: `--source DIR`, `--runs-file NAME` (inside
`--source`), `--telemetry-file NAME`, `--column-map PATH`, `--extractor heuristic|llm`, `--llm-max-pages INT`,
`--no-llm-cache`, `--no-findings`, `--fetch SOURCES_YAML`, `--dry-run`, `--skip-embed`.
NTRS PDFs can be downloaded straight into the drop folder with `--fetch` (copy `data/sources.example.yaml`).

---

## Step 1: Stage the raw files (`T+0 min`)
Copy the official CSV/JSON/PDF files into one folder, for example `backend/data/official_drop/`:
```bash
mkdir -p data/official_drop/corpus
# copy the official test matrices, telemetry and NTRS PDFs into data/official_drop/
```
Rehearse first with the deliberately messy proxy file: `make ingest-drill` (psia, ft/min, extra columns, dry run).
The drop folder `backend/data/seed/` is empty by default; copying the drop there lets `make seed` and the Docker stack
pick it up. Full reference: [INGESTION_GUIDE.md](INGESTION_GUIDE.md).

## Step 2: Map headers in `column_map.yaml` (`T+5 min`)
Inspect the headers of the official CSV:
```bash
head -n 5 data/official_drop/<official_runs.csv>
```
Open [backend/app/ingestion/adapters/column_map.yaml](../backend/app/ingestion/adapters/column_map.yaml) and add any
new column names or unit tags (`psia`, `kpa`, `ft_min`, `cm_s`, `fraction`, `pct`, `w_cm2`, `kw_m2`) under the
matching `schema_v1` field. To keep the default map untouched, copy it and pass `--column-map <your_map.yaml>`.
> [!TIP]
> **Extra columns are fine.** Any column not listed in `column_map.yaml` is kept in `extra_telemetry` (`JSONB`) and
> shown in the Ranking page's "Extra telemetry" table.

## Step 3: Dry-run the pipeline (`T+10 min`)
Verify unit conversions and rejected rows without writing anything:
```bash
uv run python -m app.ingestion --source data/official_drop --runs-file <official_runs.csv> --dry-run --skip-embed
```
Check `backend/data/.cache/review_queue.csv` for `REJECTED` rows or physics flags. If an enum alias is missing (a new
material or regime spelling), add it under `aliases:` in `column_map.yaml` and dry-run again.

## Step 3b: LLM extraction dry run (optional, needs `OPENAI_API_KEY` and/or `GEMINI_API_KEY`) (`T+12 min`)
Pull test runs, PDF metadata and scanned pages out of the NTRS documents (OpenAI primary, Gemini fallback). Start
with a small page budget, because every page is a paid call:
```bash
uv run python -m app.ingestion --source data/official_drop --runs-file <official_runs.csv> \
    --extractor llm --dry-run --skip-embed --llm-max-pages 20
# or: make ingest-llm SRC=data/official_drop RUNS=<official_runs.csv>
```
Before the full load, review the extracted rows at the top of `data/.cache/review_queue.csv`: every row flagged
`extraction:low_confidence` or `extraction:quote_not_found` (check its `source_doc_id` / `source_page`), and the
findings in `data/.cache/findings_review_queue.csv`. Results are cached in `data/.cache/extractions/`, so
re-running only pays for new or changed pages; raise `--llm-max-pages` once the sample looks right.

## Step 4: Full ingest into Postgres + pgvector (`T+15 min`)
Once the dry run reports `0 rejected`:
```bash
make db-up && make migrate
uv run python -m app.ingestion --source data/official_drop --runs-file <official_runs.csv>
```
This upserts `investigations`, `documents`, `test_runs`, `telemetry`, `presets`, `chunks` (384-d `bge-small`
embeddings) and `combustion_findings` in one transaction and refreshes the snapshot `data/.cache/store.json`.
Re-running is safe: rows are upserted and chunks / findings are replaced per document. (Add `--extractor llm` here
only if Step 3b was reviewed; cached pages cost nothing.)

## Step 5: Smoke-test (`T+20 min`)
```bash
make dev                        # or, from the repo root, `make up` after pointing the compose command at the new folder
curl http://localhost:8000/api/health   # test_runs / chunks must match the new data
make eval                       # golden set still meets its thresholds (expected ids may need updating for new data)
```
Run the frontend in live mode (`NEXT_PUBLIC_API_MODE=live` in `frontend/.env.local`, then `npm run dev`) and open
`/ranking` and `/copilot`: the new experiment ids, the extra-telemetry table and `[DOC-XX p.Y]` citations should
appear.

The frontend's mock mode keeps using the proxy examples in `contracts/examples/`. Refresh them (and run
`npm run sync:contracts` in `frontend/`) only if you want mock mode to show the official data too.
