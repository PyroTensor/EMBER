# Contract changelog

Every change to `contracts/` gets an entry: date, what changed, and why.

## 2026-11-12 — v1 frozen + ErrorResponse
- Froze `openapi_v1.yaml` (7 endpoints, paths unchanged) as the shared contract for the backend/frontend split.
- Added `components.schemas.ErrorResponse` = `{"error": {"code", "message", "details"}}` (`details` nullable).
- Every operation now documents `422` and `500` with `ErrorResponse`. `GET /api/telemetry/{experiment_id}` documents
  `404` and `POST /api/copilot/ask` documents `503`, both with `ErrorResponse`.
- Added `examples/*.json` (one captured response per endpoint, ISS preset) and `fixtures/domain_parity.json`
  (proxy runs + expected evaluation and top-5 ranking for every preset plus edge cases).
- Why: one standard error shape the frontend can rely on (plan.md D7), and shared examples/fixtures for MSW, contract
  tests and Python/TS parity (plan.md D4–D6).
