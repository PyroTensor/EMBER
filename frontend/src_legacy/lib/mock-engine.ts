/**
 * Offline mock engine - faithful TypeScript port of:
 *   data_ml/ember_data/physics/combustion.py
 *   data_ml/ember_data/models/risk.py
 *   data_ml/ember_data/ranking/scenario_ranker.py
 * KEEP IN SYNC with the Python sources (they are the reference implementation).
 */
import type {
  AskRequest,
  AskResponse,
  CabinConfig,
  CabinEvaluation,
  Citation,
  Contribution,
  Evidence,
  RankedExperiment,
  RankWeights,
  RiskBand,
  TestRun,
} from "./types";

// ============================ physics/combustion.py ============================
export const P0_KPA = 101.3;

export const MATERIAL_BASE_LOI: Record<string, number> = {
  PMMA: 17.5,
  "Cotton-Fiberglass": 18.5,
  Nomex: 27.0,
  Heptane: 13.5,
  Methanol: 15.5,
};
export const DILUENT_SHIFT: Record<string, number> = { N2: 0.0, CO2: 3.0, He: 2.0, Ar: -1.0 };

export function buoyantVelocity(gravityG: number, pressureKpa: number): number {
  return 30.0 * Math.sqrt((Math.max(gravityG, 0.0) * pressureKpa) / P0_KPA);
}

export function effectiveVelocity(flowCmS: number, gravityG: number, pressureKpa: number): number {
  return Math.sqrt(flowCmS ** 2 + buoyantVelocity(gravityG, pressureKpa) ** 2);
}

/** U-shaped LOI shift vs effective velocity (ventilation paradox minimum near 8 cm/s). */
export function flowLoiShift(uEff: number): number {
  return (
    3.0 * Math.exp(-uEff / 3.0) -
    1.5 * Math.exp(-(((uEff - 8.0) / 6.0) ** 2)) +
    0.05 * Math.max(0.0, uEff - 30.0)
  );
}

export function pressureLoiShift(pressureKpa: number): number {
  return 4.0 * (1.0 - pressureKpa / P0_KPA);
}

export function limitingOxygenIndex(
  material: string,
  gravityG: number,
  pressureKpa: number,
  flowCmS: number,
  diluent = "N2",
): number {
  const base = MATERIAL_BASE_LOI[material];
  if (base === undefined) throw new Error(`Unknown fuel_material: ${material}`);
  const u = effectiveVelocity(flowCmS, gravityG, pressureKpa);
  return base + flowLoiShift(u) + pressureLoiShift(pressureKpa) + (DILUENT_SHIFT[diluent] ?? 0.0);
}

export function predictRegime(material: string, gravityG: number, oxygenMargin: number): string {
  if (oxygenMargin < -2.0) return "No Ignition";
  if (oxygenMargin < 0.0) return "Self-Extinguished";
  if (material === "Heptane" && gravityG === 0.0 && oxygenMargin < 9.0) return "Cool Flame";
  return "Sustained Burn";
}

// ============================ models/risk.py ============================
export const BASELINE: CabinConfig = {
  oxygen_pct: 21.0,
  pressure_kpa: 101.3,
  flow_velocity_cm_s: 10.0,
  gravity_g: 0.0,
  fuel_material: "Cotton-Fiberglass",
  diluent_gas: "N2",
};

type CfgField = keyof CabinConfig;
export const FEATURE_GROUPS: Record<string, { label: string; fields: CfgField[] }> = {
  oxygen_enrichment: { label: "Oxygen concentration", fields: ["oxygen_pct"] },
  ventilation_coupling: { label: "HVAC ventilation flow", fields: ["flow_velocity_cm_s"] },
  gravity_buoyancy_regime: { label: "Gravity / buoyancy", fields: ["gravity_g"] },
  cabin_pressure_density: { label: "Cabin pressure", fields: ["pressure_kpa"] },
  material_flammability_intrinsic: { label: "Material & diluent", fields: ["fuel_material", "diluent_gas"] },
};

const sigmoid = (z: number) => 1.0 / (1.0 + Math.exp(-z));

/** Round half-to-even-ish like Python's round() for display purposes. */
export const round = (x: number, nd: number) => {
  const f = 10 ** nd;
  return Math.round(x * f) / f;
};

export function oxygenMargin(cfg: CabinConfig): { margin: number; loi: number } {
  const loi = limitingOxygenIndex(cfg.fuel_material, cfg.gravity_g, cfg.pressure_kpa, cfg.flow_velocity_cm_s, cfg.diluent_gas);
  return { margin: cfg.oxygen_pct - loi, loi };
}

export function risk(cfg: CabinConfig): number {
  return 100.0 * sigmoid((oxygenMargin(cfg).margin - 4.0) / 3.0);
}

export function riskBand(r: number): RiskBand {
  if (r < 25) return "LOW";
  if (r < 50) return "ELEVATED";
  if (r < 75) return "HIGH";
  return "CRITICAL";
}

function mix(x: CabinConfig, base: CabinConfig, groups: Iterable<string>): CabinConfig {
  const data: CabinConfig = { ...base };
  for (const g of groups) {
    for (const f of FEATURE_GROUPS[g].fields) {
      (data as unknown as Record<string, unknown>)[f] = x[f];
    }
  }
  return data;
}

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

/** Exact Shapley values over the 5 feature groups (2^5 = 32 coalitions) vs `base`. */
export function shapley(x: CabinConfig, base: CabinConfig = BASELINE): Record<string, number> {
  const names = Object.keys(FEATURE_GROUPS);
  const n = names.length;
  const cache = new Map<number, number>();
  // coalition encoded as bitmask over `names`
  const v = (mask: number): number => {
    let val = cache.get(mask);
    if (val === undefined) {
      val = risk(mix(x, base, names.filter((_, i) => mask & (1 << i))));
      cache.set(mask, val);
    }
    return val;
  };
  const popcount = (m: number) => m.toString(2).replace(/0/g, "").length;

  const phi: Record<string, number> = Object.fromEntries(names.map((k) => [k, 0]));
  names.forEach((name, i) => {
    const bit = 1 << i;
    for (let mask = 0; mask < 1 << n; mask++) {
      if (mask & bit) continue; // subsets of "others"
      const r = popcount(mask);
      const w = (factorial(r) * factorial(n - r - 1)) / factorial(n);
      phi[name] += w * (v(mask | bit) - v(mask));
    }
  });
  return phi;
}

export function evaluateCabin(cfg: CabinConfig): CabinEvaluation {
  const { margin, loi } = oxygenMargin(cfg);
  const r = risk(cfg);
  const phi = shapley(cfg);
  const contributions: Contribution[] = Object.entries(phi)
    .map(([k, v]) => ({ feature: k, label: FEATURE_GROUPS[k].label, value: round(v, 2) }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return {
    risk_index: round(r, 1),
    risk_band: riskBand(r),
    baseline_risk: round(risk(BASELINE), 1),
    predicted_regime: predictRegime(cfg.fuel_material, cfg.gravity_g, margin),
    estimated_loi_pct: round(loi, 2),
    oxygen_margin_pct: round(margin, 2),
    contributions,
  };
}

// ============================ ranking/scenario_ranker.py ============================
export const DEFAULT_WEIGHTS: RankWeights = { similarity: 0.5, completeness: 0.2, criticality: 0.3 };

const SIM_FEATURES: Record<"oxygen_pct" | "pressure_kpa" | "flow_velocity_cm_s" | "gravity_g", [number, number]> = {
  oxygen_pct: [25.0, 1.0],
  pressure_kpa: [61.3, 0.7],
  flow_velocity_cm_s: [50.0, 0.7],
  gravity_g: [1.0, 1.0],
};
const SIM_LENGTH_SCALE = 8.0;

const REGIME_SEVERITY: Record<string, number> = {
  "Sustained Burn": 1.0,
  "Cool Flame": 0.85,
  "Self-Extinguished": 0.4,
  "No Ignition": 0.1,
};
const OPTIONAL_OUTPUTS = [
  "spread_or_burn_rate",
  "peak_radiative_flux_kw_m2",
  "limiting_oxygen_index_pct",
  "burn_duration_s",
] as const;

export function similarity(run: TestRun, cfg: CabinConfig): number {
  const entries = Object.entries(SIM_FEATURES) as [keyof typeof SIM_FEATURES, [number, number]][];
  const totalW = entries.reduce((s, [, [, w]]) => s + w, 0);
  const d2 = entries.reduce((s, [f, [rng, w]]) => s + w * ((Number(run[f]) - Number(cfg[f])) / rng) ** 2, 0) / totalW;
  let s = Math.exp(-SIM_LENGTH_SCALE * d2);
  s *= run.fuel_material === cfg.fuel_material ? 1.0 : 0.6;
  s *= run.diluent_gas === cfg.diluent_gas ? 1.0 : 0.9;
  return 100.0 * s;
}

export function completeness(run: TestRun): number {
  const present = OPTIONAL_OUTPUTS.filter((k) => run[k] !== null && run[k] !== undefined).length / OPTIONAL_OUTPUTS.length;
  const extras = Math.min(Object.keys(run.extra_telemetry ?? {}).length, 6) / 6.0;
  return 70.0 * present + 30.0 * extras;
}

export function criticality(run: TestRun): number {
  const sev = REGIME_SEVERITY[run.combustion_regime] ?? 0.0;
  const flux = Math.min((run.peak_radiative_flux_kw_m2 ?? 0.0) / 10.0, 1.0);
  const loi = run.limiting_oxygen_index_pct;
  const margin = loi === null || loi === undefined ? 0.0 : Math.min(Math.max(run.oxygen_pct - loi, 0.0) / 10.0, 1.0);
  return 60.0 * sev + 25.0 * flux + 15.0 * margin;
}

export function rankRuns(
  runs: TestRun[],
  cfg: CabinConfig,
  weights?: Partial<RankWeights>,
  limit: number | null = 10,
): RankedExperiment[] {
  const w: RankWeights = { ...DEFAULT_WEIGHTS, ...(weights ?? {}) };
  const wsum = w.similarity + w.completeness + w.criticality || 1.0;
  const scored = runs.map((r) => {
    const s = similarity(r, cfg);
    const c = completeness(r);
    const k = criticality(r);
    const total = (w.similarity * s + w.completeness * c + w.criticality * k) / wsum;
    return { total, s, c, k, r };
  });
  // stable sort (Python's sort is stable too)
  scored.sort((a, b) => b.total - a.total);
  const out = scored.map(({ total, s, c, k, r }, i) => ({
    rank: i + 1,
    experiment_id: r.experiment_id,
    total_score: round(total, 2),
    similarity: round(s, 2),
    completeness: round(c, 2),
    criticality: round(k, 2),
    record: r,
  }));
  return limit ? out.slice(0, limit) : out;
}

// ============================ mock copilot ============================
/**
 * Tiny canned co-pilot. NOT the LangGraph pipeline - it ranks runs against the scenario
 * (with a couple of keyword nudges) and cites the top EXP ids.
 * TODO(squad3-B): richer mock answers (doc citations from contracts/mock_data/corpus).
 */
export function mockAsk(req: AskRequest, runs: TestRun[], defaultScenario: CabinConfig = BASELINE): AskResponse {
  const q = req.question.toLowerCase();
  let scenario: CabinConfig = req.scenario ?? defaultScenario;
  let pool = runs;

  if (!req.scenario && /artemis|34\s*%|56\.5/.test(q)) {
    scenario = { ...BASELINE, oxygen_pct: 34.0, pressure_kpa: 56.5 };
  }
  if (/cool flame|droplet|heptane/.test(q)) {
    const cool = runs.filter((r) => r.combustion_regime === "Cool Flame" || r.fuel_geometry === "Droplet");
    if (cool.length) pool = cool;
    if (!req.scenario) scenario = { ...BASELINE, fuel_material: "Heptane", flow_velocity_cm_s: 0 };
  }

  const top = rankRuns(pool, scenario, undefined, 3);
  const citations: Citation[] = top.map((t) => ({
    id: `[${t.experiment_id}]`,
    kind: "experiment",
    doc_id: t.record.source_doc_id ?? null,
    page: t.record.source_page ?? null,
    experiment_id: t.experiment_id,
    snippet: describeRun(t.record),
  }));
  const evidence: Evidence[] = top.map((t) => ({
    id: t.experiment_id,
    kind: "ranked_run",
    source: "scenario_ranker",
    score: t.total_score,
    text: describeRun(t.record),
    doc_id: t.record.source_doc_id ?? null,
    page: t.record.source_page ?? null,
    experiment_id: t.experiment_id,
  }));

  const lines = top.map((t) => `- ${describeRun(t.record)} [${t.experiment_id}]`).join("\n");
  const answer =
    `(Mock mode - canned answer from the offline scenario ranker, not the LangGraph co-pilot.)\n\n` +
    `For a cabin at ${scenario.oxygen_pct}% O2 / ${scenario.pressure_kpa} kPa / ${scenario.flow_velocity_cm_s} cm/s / ${scenario.gravity_g} g, ` +
    `the most relevant test runs are:\n${lines}`;

  return {
    answer,
    route: "search",
    supported: true,
    rewrites: 0,
    citations,
    evidence,
    dropped_claims: [],
    trace_id: `mock-${Date.now().toString(36)}`,
  };
}

function describeRun(r: TestRun): string {
  const loi = r.limiting_oxygen_index_pct != null ? `, LOI ${r.limiting_oxygen_index_pct}%` : "";
  return `${r.program} ${r.fuel_material} (${r.fuel_geometry}) at ${r.oxygen_pct}% O2, ${r.pressure_kpa} kPa, ${r.flow_velocity_cm_s} cm/s, ${r.gravity_g} g -> ${r.combustion_regime}${loi}`;
}
