# EMBER frontend

Mission-control console for **EMBER** (microgravity fire safety & combustion digital twin).
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind CSS 4 · React Query 5 · MSW 2.

The UI is built against `contracts/openapi_v1.yaml` and runs either on **mocks** (MSW in the browser, no backend
needed) or **live** against the FastAPI backend. Switching between them changes configuration only, never app code.

| Route | Module |
|---|---|
| `/` | Overview: mission KPIs and module cards |
| `/cabin` | Cabin Configurator: risk index, LOI, Shapley drivers |
| `/twin` | Flame Twin: WebGL2 volumetric flame (all math runs locally) |
| `/ranking` | Ranking & Telemetry: scenario ranking, score breakdown, telemetry chart |
| `/copilot` | SI Co-Pilot: grounded Q&A with citation chips and evidence |

## Requirements

Node.js 22 and npm. Commands below run from `frontend/`.

## Mock mode (default)

```bash
cp .env.example .env.local     # NEXT_PUBLIC_API_MODE=mock
npm install
npm run dev                    # http://localhost:3000
```

Every `/api/*` request is answered in the browser by MSW (`public/mockServiceWorker.js`, handlers in
`src/mocks/handlers/`). The handlers compute results with a TypeScript port of the backend domain engine
(`src/mocks/engine/`), so numbers match the backend for the same inputs. A **MOCK** badge and banner are always shown.

Try the UI states with a query string on any page: `?scenario=slow` (1.5 s latency), `?scenario=error` (500 envelope),
`?scenario=empty` (empty lists) or `?scenario=offline` (network failure).

## Live mode (against the backend)

Start the backend (see `backend/README.md`, it serves on `http://localhost:8000`), then in `.env.local`:

```bash
NEXT_PUBLIC_API_MODE=live
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_ALLOW_MODE_TOGGLE=true   # show the mock/live switch in the top bar (dev convenience)
```

Restart `npm run dev`. MSW is not loaded in live mode. If the backend is unreachable the badge shows **OFFLINE** and
each panel shows an error with a retry button. The app never falls back to mock data in live mode.

`NEXT_PUBLIC_*` values are inlined at build time; a production build needs them set before `npm run build`.

## Docker

```bash
docker build -t ember-frontend .                          # mock mode
docker build -t ember-frontend \
  --build-arg NEXT_PUBLIC_API_MODE=live \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 . # live mode
docker run --rm -p 3000:3000 ember-frontend
```

The image runs the standalone Next.js server as a non-root user on port 3000. `NEXT_PUBLIC_API_URL` is called from
the **browser**, so it must be a URL the user's machine can reach (not a Docker-internal hostname).

## Regenerate the API types

`src/lib/api/schema.d.ts` is generated from the contract. Never edit it by hand.

```bash
npm run gen:api        # from ../contracts/openapi_v1.yaml
npm run gen:api:live   # from a running backend (http://localhost:8000/openapi.json); must produce no diff
npm run sync:contracts # copy contract examples + parity fixture into src/mocks/fixtures/
```

Friendly aliases (`AskResponse`, `CabinConfig`, …) live in `src/lib/api/types.ts`. CI fails if `gen:api` changes
`schema.d.ts`, so commit the regenerated file together with any contract change.

## Add an MSW handler

1. Create `src/mocks/handlers/<area>.ts` and answer through `respond()` so `?scenario=` works:

   ```ts
   import { http } from "msw";
   import type { Preset } from "@/lib/api/types";
   import presetsFixture from "../fixtures/presets.json";
   import { respond } from "../scenarios";

   export const presetHandlers = [
     // respond(build, empty?, request): latency + slow/error/empty/offline scenarios
     http.get("*/api/presets", ({ request }) =>
       respond<Preset[]>(() => presetsFixture as Preset[], () => [], request),
     ),
   ];
   ```

2. Register it in `src/mocks/handlers/index.ts`.
3. Return the same error envelope as the backend (`{ error: { code, message, details } }`) for 4xx cases.

Only `src/app/providers.tsx` may import from `@/mocks` (enforced by ESLint), so mocks never leak into live mode.

## Add a feature

1. API call in `src/features/<x>/api.ts`, always through `apiFetch` from `@/lib/api/client` (no direct `fetch`).
2. React Query hook in `src/features/<x>/hooks.ts` with a key from `@/lib/api/query-keys`.
3. Components in `src/features/<x>/components/` (`"use client"` when they fetch or hold state). Every data panel
   shows a skeleton while loading, `ErrorState` with retry on failure and `EmptyState` when there is nothing to show.
4. Export the public pieces from `src/features/<x>/index.ts`. Other features import only from that index.
5. Route in `src/app/<route>/page.tsx`: a Server Component that sets `metadata` and renders the feature view.
6. Add the mock handler (above) and a nav entry in `src/components/layout/nav-items.ts`.

Shared, feature-agnostic UI lives in `src/components/` (`ui/`, `layout/`, `charts/`) and must not import features.

## Scripts

| Script | Does |
|---|---|
| `dev` / `build` / `start` | dev server (:3000) / production build (standalone output) / serve the build |
| `lint` | ESLint, including import-boundary rules |
| `typecheck` | `tsc --noEmit` |
| `format` | Prettier (+ Tailwind class sorting) on `src/` |
| `gen:api` / `gen:api:live` | regenerate `src/lib/api/schema.d.ts` from the contract / a running backend |
| `sync:contracts` | refresh `src/mocks/fixtures/` from `contracts/` |
