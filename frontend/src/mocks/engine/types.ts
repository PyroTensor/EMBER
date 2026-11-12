// Engine-facing types: contract types plus the engine's own value types.
// Mirrors backend/app/domain/types.py.
import type {
  CabinConfig,
  CabinEvaluation,
  Contribution,
  RankedExperiment,
  RankRequest,
  RankResponse,
  RankWeights,
  RiskBand,
  TestRunRecord,
} from "@/lib/api/types";

export type {
  CabinConfig,
  CabinEvaluation,
  Contribution,
  RankedExperiment,
  RankRequest,
  RankResponse,
  RankWeights,
  RiskBand,
  TestRunRecord,
};

/** A record as stored in fixtures: optional outputs may be absent or null. */
export type Run = TestRunRecord;

export type CabinField = keyof CabinConfig;

export type FeatureGroup =
  | "oxygen_enrichment"
  | "ventilation_coupling"
  | "gravity_buoyancy_regime"
  | "cabin_pressure_density"
  | "material_flammability_intrinsic";

/** ISS standard atmosphere, the Shapley reference point (backend ISS_BASELINE). */
export const ISS_BASELINE: Readonly<CabinConfig> = Object.freeze({
  oxygen_pct: 21.0,
  pressure_kpa: 101.3,
  flow_velocity_cm_s: 10.0,
  gravity_g: 0.0,
  fuel_material: "Cotton-Fiberglass",
  diluent_gas: "N2",
});

const normalizeZero = (v: number) => (Object.is(v, -0) ? 0 : v);

/**
 * Python's round(x, ndigits): decides on the exact binary value (not `x * 10^n`) and breaks exact ties
 * half-to-even, e.g. pyRound(95.625, 2) === 95.62 (95.625 is exactly representable; toFixed gives 95.63).
 */
export function pyRound(x: number, ndigits: number): number {
  if (!Number.isFinite(x)) return x;
  // Exact ties have a short binary fraction, so 30 extra digits expose them as "5000…".
  const [intPart = "", frac = ""] = x.toFixed(Math.min(100, ndigits + 30)).split(".");
  if (/^50*$/.test(frac.slice(ndigits))) {
    const kept = Number(ndigits > 0 ? `${intPart}.${frac.slice(0, ndigits)}` : intPart);
    const lastDigit = Number((intPart + frac.slice(0, ndigits)).slice(-1));
    if (lastDigit % 2 === 0) return normalizeZero(kept);
    return normalizeZero(Number((kept + Math.sign(x) * 10 ** -ndigits).toFixed(ndigits)));
  }
  return normalizeZero(Number(x.toFixed(ndigits)));
}
