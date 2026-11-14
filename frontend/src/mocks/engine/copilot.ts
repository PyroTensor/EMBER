// Mock SI Co-Pilot. NOT the LangGraph pipeline: it ranks runs for the scenario with the TS ranker and builds a
// short answer whose sentences each cite one run. Scope check, NO_DATA text and evidence format mirror the backend
// (app/rag/scope.py, app/core/constants.py, app/rag/nodes/scenario_ranker.py).
import type { AskRequest, AskResponse, Citation, Evidence } from "@/lib/api/types";
import { rankRuns } from "./ranker";
import { ISS_BASELINE, type RankedExperiment, type Run } from "./types";

export const NO_DATA_MESSAGE =
  "No data: the EMBER microgravity combustion database and NASA PSI/NTRS corpus do not contain " +
  "verified evidence to answer this question.";

/** Same vocabulary as backend app/rag/scope.py DOMAIN_KEYWORDS. */
const DOMAIN_KEYWORDS = new Set([
  "flame", "fire", "burn", "combustion", "oxygen", "o2", "loi", "pressure", "kpa", "psia",
  "flow", "ventilation", "hvac", "microgravity", "0g", "1g", "gravity", "lunar", "mars",
  "artemis", "iss", "bass", "bass-ii", "sofie", "flex", "acme", "saffire", "pmma", "nomex", "cotton",
  "fiberglass", "sibal", "heptane", "methanol", "droplet", "cool", "radiative", "flux",
  "extinguish", "ignition", "spread", "diluent", "co2", "helium", "argon", "nitrogen",
  "nasa", "6001b", "spacecraft", "cabin", "habitat", "exp-", "doc-", "soot", "standoff",
]); // prettier-ignore

const TOP_N = 3;
let traceCounter = 0;

/** Backend router rule: out of scope when no domain token and no EXP id. */
export function isInScope(question: string): boolean {
  const q = question.toLowerCase().trim();
  const tokens = q.match(/[a-z0-9_-]+/g) ?? [];
  return tokens.some((t) => DOMAIN_KEYWORDS.has(t)) || /exp-\d+/.test(q);
}

/** Python str() of a float (21 → "21.0"), so mock text matches the backend's f-strings. */
const pyNum = (v: number | null | undefined) =>
  v === null || v === undefined ? "None" : Number.isInteger(v) ? `${v}.0` : String(v);

/** Same text as the backend scenario_ranker evidence. */
function describe(r: RankedExperiment): string {
  const rec = r.record as Run;
  return (
    `${r.experiment_id} (rank #${r.rank}, score=${(r.total_score ?? 0).toFixed(1)} ` +
    `[sim=${(r.similarity ?? 0).toFixed(0)}, comp=${(r.completeness ?? 0).toFixed(0)}, crit=${(r.criticality ?? 0).toFixed(0)}]): ` +
    `${rec.program} ${rec.fuel_material} at ${pyNum(rec.gravity_g)}g, ${pyNum(rec.oxygen_pct)}% O2, ` +
    `${pyNum(rec.pressure_kpa)} kPa, ${pyNum(rec.flow_velocity_cm_s)} cm/s -> ${rec.combustion_regime} ` +
    `(LOI=${pyNum(rec.limiting_oxygen_index_pct)}%, rate=${pyNum(rec.spread_or_burn_rate)})`
  );
}

/** One answer sentence per run, each ending with its [EXP-xxxx] citation tag. */
function sentence(r: RankedExperiment, i: number): string {
  const rec = r.record as Run;
  const loi = rec.limiting_oxygen_index_pct != null ? ` with an LOI of ${rec.limiting_oxygen_index_pct}%` : "";
  const lead =
    i === 0
      ? `The closest match is ${r.experiment_id}, a ${rec.program} ${rec.fuel_material} run`
      : i === 1
        ? `${r.experiment_id}, a ${rec.program} ${rec.fuel_material} run`
        : `${r.experiment_id} (${rec.program} ${rec.fuel_material})`;
  const tail = i === 1 ? "also supports this comparison" : "adds further evidence";
  const body =
    i === 0
      ? `${lead} at ${rec.oxygen_pct}% O2, ${rec.pressure_kpa} kPa and ${rec.gravity_g} g that ended in ${rec.combustion_regime}${loi}`
      : `${lead} at ${rec.oxygen_pct}% O2 and ${rec.flow_velocity_cm_s} cm/s ended in ${rec.combustion_regime}${loi} and ${tail}`;
  return `${body} [${r.experiment_id}].`;
}

const traceId = () => `mock-${++traceCounter}`;

export function mockAsk(req: AskRequest, runs: readonly Run[]): AskResponse {
  if (!isInScope(req.question)) {
    return {
      answer: NO_DATA_MESSAGE,
      route: "out_of_scope",
      supported: false,
      rewrites: 0,
      citations: [],
      evidence: [],
      dropped_claims: [],
      trace_id: traceId(),
    };
  }

  const scenario = req.scenario ?? ISS_BASELINE;
  const top = rankRuns(runs, scenario, null, TOP_N);

  const citations: Citation[] = top.map((r) => ({
    id: `[${r.experiment_id}]`,
    kind: "experiment",
    doc_id: r.record?.source_doc_id ?? null,
    page: r.record?.source_page ?? null,
    experiment_id: r.experiment_id ?? null,
    snippet: describe(r),
  }));

  const evidence: Evidence[] = top.map((r) => ({
    id: r.experiment_id,
    kind: "ranked_run",
    source: "scenario_ranker",
    score: Math.round((r.total_score ?? 0) * 10) / 1000, // total / 100, 3 decimals
    text: describe(r),
    doc_id: r.record?.source_doc_id ?? null,
    page: r.record?.source_page ?? null,
    experiment_id: r.experiment_id ?? null,
  }));

  return {
    answer: top.map(sentence).join(" "),
    route: "compare",
    supported: true,
    rewrites: 0,
    citations,
    evidence,
    dropped_claims: [],
    trace_id: traceId(),
  };
}
