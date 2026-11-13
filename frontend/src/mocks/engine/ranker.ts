// Port of backend/app/domain/ranking/scenario_ranker.py.
//
// TotalScore = (w_sim*S_sim + w_comp*S_comp + w_crit*S_crit) / (w_sim + w_comp + w_crit)
//   S_sim  (0-100) weighted Gaussian similarity in normalised (O2, P, flow, g) space,
//                  x material match (1.0 / 0.6) x diluent match (1.0 / 0.9)
//   S_comp (0-100) 70 * fraction of optional outputs present + 30 * richness of extra_telemetry
//   S_crit (0-100) 60 * regime severity + 25 * radiative flux + 15 * positive O2 margin over LOI
import {
  pyRound,
  type CabinConfig,
  type RankedExperiment,
  type RankRequest,
  type RankResponse,
  type RankWeights,
  type Run,
} from "./types";

export const DEFAULT_WEIGHTS: Readonly<RankWeights> = { similarity: 0.5, completeness: 0.2, criticality: 0.3 };

type SimFeature = "oxygen_pct" | "pressure_kpa" | "flow_velocity_cm_s" | "gravity_g";
/** feature → [normalising range, importance] */
const SIM_FEATURES: Readonly<Record<SimFeature, readonly [number, number]>> = {
  oxygen_pct: [25.0, 1.0],
  pressure_kpa: [61.3, 0.7],
  flow_velocity_cm_s: [50.0, 0.7],
  gravity_g: [1.0, 1.0],
};
const SIM_LENGTH_SCALE = 8.0; // higher = sharper similarity falloff

const REGIME_SEVERITY: Readonly<Record<string, number>> = {
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

const SIM_ENTRIES = Object.entries(SIM_FEATURES) as [SimFeature, readonly [number, number]][];

export function similarity(run: Run, cfg: CabinConfig): number {
  let totalW = 0;
  for (const [, [, w]] of SIM_ENTRIES) totalW += w;
  let sum = 0;
  for (const [f, [rng, w]] of SIM_ENTRIES) sum += w * ((Number(run[f]) - Number(cfg[f])) / rng) ** 2;
  const d2 = sum / totalW;
  let s = Math.exp(-SIM_LENGTH_SCALE * d2);
  s *= run.fuel_material === cfg.fuel_material ? 1.0 : 0.6;
  s *= run.diluent_gas === cfg.diluent_gas ? 1.0 : 0.9;
  return 100.0 * s;
}

export function completeness(run: Run): number {
  const present = OPTIONAL_OUTPUTS.filter((k) => run[k] != null).length / OPTIONAL_OUTPUTS.length;
  const extras = Math.min(Object.keys(run.extra_telemetry ?? {}).length, 6) / 6.0;
  return 70.0 * present + 30.0 * extras;
}

export function criticality(run: Run): number {
  const sev = REGIME_SEVERITY[run.combustion_regime] ?? 0.0;
  const flux = Math.min((run.peak_radiative_flux_kw_m2 || 0.0) / 10.0, 1.0);
  const loi = run.limiting_oxygen_index_pct;
  const margin = loi == null ? 0.0 : Math.min(Math.max(Number(run.oxygen_pct) - Number(loi), 0.0) / 10.0, 1.0);
  return 60.0 * sev + 25.0 * flux + 15.0 * margin;
}

export function rankRuns(
  runs: readonly Run[],
  cfg: CabinConfig,
  weights?: Partial<RankWeights> | null,
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
  scored.sort((a, b) => b.total - a.total); // stable, like Python's list.sort
  const out = scored.map(({ total, s, c, k, r }, i) => ({
    rank: i + 1,
    experiment_id: r.experiment_id,
    total_score: pyRound(total, 2),
    similarity: pyRound(s, 2),
    completeness: pyRound(c, 2),
    criticality: pyRound(k, 2),
    record: r,
  }));
  return limit ? out.slice(0, limit) : out;
}

/** POST /api/experiments/rank in mock mode. */
export function rankMock(runs: readonly Run[], req: RankRequest): RankResponse {
  const weights: RankWeights = { ...DEFAULT_WEIGHTS, ...(req.weights ?? {}) };
  return { weights, results: rankRuns(runs, req.config, weights, req.limit ?? 10) };
}
