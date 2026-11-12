# contracts/

The only thing both `backend/` and `frontend/` read. It holds **data only**, never code.

| Path | What |
|---|---|
| `openapi_v1.yaml` | REST contract: 7 endpoints + `ErrorResponse` |
| `schema_v1.json` | one row = one combustion test run |
| `examples/*.json` | one example response per endpoint (MSW handlers + backend contract tests) |
| `fixtures/domain_parity.json` | inputs → expected risk / Shapley / top-5 rank (pytest + vitest) |
| `CHANGELOG.md` | every contract change, with date and reason |

## How to change the contract

1. Open a PR that edits `contracts/openapi_v1.yaml` (plus `examples/` and `CHANGELOG.md`).
2. Additive changes (a new optional field or a new endpoint) stay `v1`. Breaking changes (rename, remove, type change)
   need a new `openapi_v2.yaml` and `/api/v2` routes.
3. Backend: update `schemas/` until `test_contract.py` passes.
4. Frontend: run `npm run gen:api`, fix the TypeScript errors, and update the MSW handlers and fixtures.
5. Both owners approve, then merge.
