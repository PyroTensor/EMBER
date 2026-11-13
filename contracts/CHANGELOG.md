# Contract changelog

Every change to `contracts/` gets an entry: date, what changed, and why.

## 2026-11-13: align with the served backend (wiring W1)
- Named enums `Program`, `FuelMaterial`, `DiluentGas`, `CombustionRegime`, `EvidenceSource` (same values as
  `schema_v1.json`). `CabinConfig`/`Preset` `fuel_material` and `diluent_gas`, `CabinEvaluation.predicted_regime` and
  `Evidence.source` use them instead of plain strings.
- Response fields the backend always sends are now `required` (Health, Preset id/name/description, Contribution,
  CabinEvaluation, RankedExperiment, RankResponse, Telemetry, Citation, Evidence, AskResponse). Optional fields stay
  optional: `Health.schema_version`/`extra_telemetry_keys`, `Telemetry.d_squared_mm2`, `Citation`/`Evidence` locators,
  `AskResponse.citations`/`evidence`/`dropped_claims`.
- Request bodies of `POST /api/evaluate-cabin`, `/api/experiments/rank` and `/api/copilot/ask` are `required`.
- `AskRequest.scenario` may be `null`.
- `GET /api/experiments` documents its optional filters `program`, `fuel_material`, `combustion_regime`, `gravity_g`.
- `POST /api/copilot/ask` documents `504` (upstream timeout) with `ErrorResponse`.
- Why: `make contract-check` only tested that the app covered the contract, so these differences went unnoticed until
  `npm run gen:api:live` produced different types. In each case the backend was the more precise side (fields always
  present, values already validated with 422, real features the frontend uses). `make contract-check` is now two-way,
  so this kind of drift fails CI.

## 2026-11-12 — v1 frozen + ErrorResponse
- Froze `openapi_v1.yaml` (7 endpoints, paths unchanged) as the shared contract for the backend/frontend split.
- Added `components.schemas.ErrorResponse` = `{"error": {"code", "message", "details"}}` (`details` nullable).
- Every operation now documents `422` and `500` with `ErrorResponse`. `GET /api/telemetry/{experiment_id}` documents
  `404` and `POST /api/copilot/ask` documents `503`, both with `ErrorResponse`.
- Added `examples/*.json` (one captured response per endpoint, ISS preset) and `fixtures/domain_parity.json`
  (proxy runs + expected evaluation and top-5 ranking for every preset plus edge cases).
- Why: one standard error shape the frontend can rely on (plan.md D7), and shared examples/fixtures for MSW, contract
  tests and Python/TS parity (plan.md D4–D6).
