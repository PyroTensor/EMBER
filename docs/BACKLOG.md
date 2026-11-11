# EMBER Squad Backlog (`TODO` Map)

The monorepo backbone is wired end-to-end. Below is the prioritized backlog for each of our 6 teammates leading up to and during the **Nov 14 data drop**. Search the codebase for `TODO(squad` to jump directly to any stub.

---

## Squad 1 (`data_ml/`)

### Track S1-A: Ingestion & Document Extraction
- [ ] **`TODO(squad1-A)` PDF / Table Parsing** ([parse.py](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/data_ml/ember_data/ingestion/parse.py)): Add table extraction (PyMuPDF / Docling) so test matrices inside NTRS PDFs emit structured rows.
- [ ] **`TODO(squad1-A)` Gemini Structured Extraction** ([llm_extract.py](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/data_ml/ember_data/ingestion/llm_extract.py)): Implement `GeminiExtractor` using `google-genai` `response_schema` to pull `Investigation` and `TestRun` records from prose pages with `(source_doc_id, source_page)` provenance.
- [ ] **`TODO(squad1-A)` NTRS / PSI Fetcher** ([fetch_cache.py](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/data_ml/ember_data/ingestion/fetch_cache.py)): Add `fetch_url()` to download official NTRS PDFs / PSI CSVs directly into `data_ml/.cache/raw/`.

### Track S1-B: Physics, Surrogate Risk & Ranking
- [ ] **`TODO(squad1-B)` 2D Flammability Phase Grid** ([combustion.py](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/data_ml/ember_data/physics/combustion.py)): Implement `phase_grid(gravity_g, flow_cm_s, material, diluent)` returning an $(O_2\%, P_{\text{kPa}})$ contour matrix for Module 1's Plotly phase diagram.
- [ ] **`TODO(squad1-B)` Calibrate Surrogate on Nov 14 Data** ([risk.py](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/data_ml/ember_data/models/risk.py)): Fit `MATERIAL_BASE_LOI` and flow/pressure coefficients (or a gradient-boosted classifier) on the official dataset while keeping the exact 32-coalition Shapley wrapper.
- [ ] **`TODO(squad1-B)` Learned Ranker Length-Scales** ([scenario_ranker.py](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/data_ml/ember_data/ranking/scenario_ranker.py)): Tune `SIM_FEATURES` weights based on empirical sensitivity in the Nov 14 dataset.

---

## Squad 2 (`backend/`)

### Track S2-A: LangGraph RAG Quality & Evaluation
- [ ] **`TODO(squad2-A)` Cross-Encoder Reranker** ([hybrid_retriever.py](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/backend/app/rag/nodes/hybrid_retriever.py)): Rerank the top-20 RRF candidates using `BAAI/bge-reranker-base` before passing top-5 to `evidence_grader`.
- [ ] **`TODO(squad2-A)` Guardrailed Text-to-SQL** ([sql_tool.py](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/backend/app/rag/nodes/sql_tool.py)): Add LLM SQL generation restricted to `SELECT` queries over `investigations` and `test_runs` via `ember_ro`.
- [ ] **`TODO(squad2-A)` 30-Question Golden Set & RAGAS** ([golden_set.jsonl](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/backend/eval/golden_set.jsonl), [run_eval.py](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/backend/eval/run_eval.py)): Expand `golden_set.jsonl` from 8 to 30 questions and integrate RAGAS faithfulness & answer relevancy scoring.

### Track S2-B: API Extensions & Compliance Brief Generator
- [ ] **`TODO(squad2-B)` NASA-STD-6001B Compliance Brief Endpoint** ([routes_copilot.py](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/backend/app/api/routes_copilot.py)): Implement `POST /api/copilot/compliance-brief` returning a structured, downloadable Markdown/PDF report cross-referencing cabin evaluation metrics, top ranked experiments, and cited NTRS clauses.
- [ ] **`TODO(squad2-B)` Phase Grid Response in `/api/evaluate-cabin`** ([routes_cabin.py](file:///Users/dulnithliyanage/Academics/PyroTensor/EMBER/backend/app/api/routes_cabin.py)): Include S1-B's `phase_grid` output in `POST /api/evaluate-cabin` so Module 1 renders the 2D phase diagram.

---

## Squad 3 (`frontend/`)

### Track S3-A: Module 1 & Module 3 Telemetry Charts
- [ ] **`TODO(squad3-A)` Plotly 2D Flammability Phase Diagram** (`/cabin`): Render the $(O_2\%, P_{\text{kPa}})$ regime contour plot with the current cabin crosshair and historical NASA test points.
- [ ] **`TODO(squad3-A)` Interactive Ranking Weight Sliders & 3-Panel Synced Telemetry** (`/ranking`): Add sliders for $w_{\text{sim}}, w_{\text{comp}}, w_{\text{crit}}$ and synchronize Flame Radius ($\text{mm}$), $d^2$ Droplet Regression ($\text{mm}^2$), and Radiative Heat Flux ($\text{kW/m}^2$).

### Track S3-B: Module 2 Digital Twin & Module 4 Co-Pilot UX
- [ ] **`TODO(squad3-B)` Interactive 1G vs 0G Flame Canvas & HVAC Paradox Simulator** (`/twin`): Animate convective plume particles vs. 0G spherical diffusion front, add the purple Cool Flame regime transition, and build the 1-click "HVAC Ventilation Paradox" demonstration.
- [ ] **`TODO(squad3-B)` Compliance Brief Preview & Download Modal** (`/copilot`): Wire a 1-click "Generate NASA-STD-6001B Compliance Brief" button that previews and downloads the markdown report from `POST /api/copilot/compliance-brief`.
