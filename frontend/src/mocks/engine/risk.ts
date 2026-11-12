// Port of backend/app/domain/risk/fire_risk.py: risk(x) = 100 * sigmoid((O2 - LOI(x) - 4) / 3) with exact
// Shapley attributions over 5 feature groups, so sum(contributions) == risk(x) - risk(baseline).
import { limitingOxygenIndex, predictRegime } from "./combustion";
import { exactShapley } from "./shapley";
import {
  ISS_BASELINE,
  pyRound,
  type CabinConfig,
  type CabinEvaluation,
  type CabinField,
  type Contribution,
  type FeatureGroup,
  type RiskBand,
} from "./types";

/** Feature group → [label, CabinConfig fields it controls]. Order matters (Shapley enumeration). */
export const FEATURE_GROUPS: Readonly<Record<FeatureGroup, readonly [string, readonly CabinField[]]>> = {
  oxygen_enrichment: ["Oxygen concentration", ["oxygen_pct"]],
  ventilation_coupling: ["HVAC ventilation flow", ["flow_velocity_cm_s"]],
  gravity_buoyancy_regime: ["Gravity / buoyancy", ["gravity_g"]],
  cabin_pressure_density: ["Cabin pressure", ["pressure_kpa"]],
  material_flammability_intrinsic: ["Material & diluent", ["fuel_material", "diluent_gas"]],
};
const GROUP_NAMES = Object.keys(FEATURE_GROUPS) as FeatureGroup[];

function sigmoid(z: number): number {
  return 1.0 / (1.0 + Math.exp(-z));
}

/** Returns [oxygen_pct - LOI, LOI]. */
export function oxygenMargin(cfg: CabinConfig): [number, number] {
  const loi = limitingOxygenIndex(
    cfg.fuel_material,
    cfg.gravity_g,
    cfg.pressure_kpa,
    cfg.flow_velocity_cm_s,
    cfg.diluent_gas,
  );
  return [cfg.oxygen_pct - loi, loi];
}

export function risk(cfg: CabinConfig): number {
  const [margin] = oxygenMargin(cfg);
  return 100.0 * sigmoid((margin - 4.0) / 3.0);
}

export function riskBand(r: number): RiskBand {
  if (r < 25) return "LOW";
  if (r < 50) return "ELEVATED";
  if (r < 75) return "HIGH";
  return "CRITICAL";
}

/** `base` with the fields of `groups` taken from `x`. */
function mix(x: CabinConfig, base: CabinConfig, groups: Iterable<FeatureGroup>): CabinConfig {
  const out: Record<CabinField, unknown> = { ...base };
  for (const g of groups) for (const f of FEATURE_GROUPS[g][1]) out[f] = x[f];
  return out as CabinConfig;
}

/** Exact Shapley value of each feature group for risk(x) - risk(base) (unrounded). */
export function shapleyContributions(
  x: CabinConfig,
  base: CabinConfig = ISS_BASELINE,
): Record<FeatureGroup, number> {
  return exactShapley((s) => risk(mix(x, base, s)), GROUP_NAMES);
}

export function evaluateCabinMock(cfg: CabinConfig, baseline: CabinConfig = ISS_BASELINE): CabinEvaluation {
  const [margin, loi] = oxygenMargin(cfg);
  const r = risk(cfg);
  const phi = shapleyContributions(cfg, baseline);
  // Array.prototype.sort is stable, like Python's sorted().
  const contributions: Contribution[] = GROUP_NAMES.map((k) => ({
    feature: k,
    label: FEATURE_GROUPS[k][0],
    value: pyRound(phi[k], 2),
  })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return {
    risk_index: pyRound(r, 1),
    risk_band: riskBand(r),
    baseline_risk: pyRound(risk(baseline), 1),
    predicted_regime: predictRegime(cfg.fuel_material, cfg.gravity_g, margin),
    estimated_loi_pct: pyRound(loi, 2),
    oxygen_margin_pct: pyRound(margin, 2),
    contributions,
  };
}
