# EMBER Frontend (`frontend/`) — Squad 3

Next.js 16 (App Router, TypeScript, Tailwind CSS v4) Mission Control console for **EMBER** (Microgravity Fire Safety & Combustion Digital Twin).

## Quick Start

```bash
cd frontend
npm install
npm run sync-mocks
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Live API vs. Offline Mock Mode

The frontend is 100% decoupled from the backend via `contracts/openapi_v1.yaml` and `contracts/schema_v1.json`:

1. **Runtime Toggle (Top Bar)**: Click the **Data Source (Live API / Mock Mode)** switch in the top telemetry header at any time. Your selection persists in `localStorage` (`ember_use_mock_data`) and is exposed via `useDataMode()` in `src/lib/api.ts`.
2. **Build/Environment Default**: Copy `.env.local.example` to `.env.local` and set:
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_USE_MOCK_DATA=true
   ```
3. **Graceful Offline Fallback**: If the app is in Live API mode and the FastAPI server at `NEXT_PUBLIC_API_URL` is not running yet, the top bar displays an `OFFLINE` status badge and banner with a one-click **Switch to Mock Mode** button while serving deterministic mock fallback data so no page ever crashes.

## Syncing Contract Mock Data

Whenever `contracts/mock_data/` is updated by Squad 1, sync the JSON proxies into `src/mock/`:

```bash
npm run sync-mocks
```

## Module Routes

- `/` — **Mission Overview**: System telemetry counters, 4 module cards, and contract-first architecture summary.
- `/cabin` — **Module 1 (Cabin Configurator)**: Mission presets (`getPresets()`), atmospheric & fuel sliders, Limiting Oxygen Index (LOI), Risk Index (0–100), and exact $2^5=32$ coalition Shapley attribution bars (`evaluateCabin()`).
- `/twin` — **Module 2 (1g vs 0g Flame Digital Twin)**: Side-by-side static SVG physics diagrams comparing 1g Buoyant Teardrop Flames against 0g Spherical Diffusion & Cool Flame regimes, plus Squad 3-B extension points.
- `/ranking` — **Module 3 (PSI Scenario Ranker & Telemetry)**: Multi-objective ranking table (`rankExperiments()`), interactive dual-axis SVG telemetry chart (`getTelemetry()`), and dynamic `record.extra_telemetry` escape-hatch inspector.
- `/copilot` — **Module 4 (SI Co-Pilot)**: Grounded RAG console (`askCopilot()`) with starter prompts, route & support badges, clickable `[DOC-XX, p.Y]` / `[EXP-XXXX]` citation chips, and evidence grouped by LangGraph source node (`sql_tool`, `hybrid_retriever`, `scenario_ranker`).
