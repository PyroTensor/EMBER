// display-only copy, keep in sync with backend domain/physics
// (mirrors src/mocks/engine/{combustion,risk}.ts, which features may not import).
import type { CabinConfig, RiskBand } from "@/lib/api/types";

export type FuelGeometry = "Droplet" | "Gaseous" | "Rod" | "Flat Sheet";
export type FlowDirection = "right" | "left" | "up" | "down";

export interface FlameParams extends CabinConfig {
  geometry: FuelGeometry;
  flowDirection: FlowDirection;
}

export interface FlamePhysics {
  uBuoyant: number;
  uEff: number;
  loi: number;
  margin: number;
  regime: string;
  riskIndex: number;
  riskBand: RiskBand;
  /** Illustrative peak flame temperature (K). */
  tempK: number;
  /** Relative flame size (1.0 = reference). */
  sizeFactor: number;
}

const P0_KPA = 101.3;

const MATERIAL_BASE_LOI: Readonly<Record<string, number>> = {
  PMMA: 17.5,
  "Cotton-Fiberglass": 18.5,
  Nomex: 27.0,
  Heptane: 13.5,
  Methanol: 15.5,
};
const DILUENT_SHIFT: Readonly<Record<string, number>> = { N2: 0.0, CO2: 3.0, He: 2.0, Ar: -1.0 };

/** Characteristic buoyancy-induced velocity (cm/s); ~30 cm/s at 1g sea level. */
export function buoyantVelocity(gravityG: number, pressureKpa: number): number {
  return 30.0 * Math.sqrt((Math.max(gravityG, 0.0) * pressureKpa) / P0_KPA);
}

/** u_eff = sqrt(u_forced^2 + u_buoyant^2). */
export function effectiveVelocity(flowCmS: number, gravityG: number, pressureKpa: number): number {
  return Math.sqrt(flowCmS ** 2 + buoyantVelocity(gravityG, pressureKpa) ** 2);
}

/** U-shaped LOI shift vs effective velocity (ventilation-paradox minimum near 8 cm/s, blow-off > 30). */
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
  const base = MATERIAL_BASE_LOI[material] ?? 18.0;
  const u = effectiveVelocity(flowCmS, gravityG, pressureKpa);
  return base + flowLoiShift(u) + pressureLoiShift(pressureKpa) + (DILUENT_SHIFT[diluent] ?? 0.0);
}

export function predictRegime(material: string, gravityG: number, oxygenMargin: number): string {
  if (oxygenMargin < -2.0) return "No Ignition";
  if (oxygenMargin < 0.0) return "Self-Extinguished";
  if (material === "Heptane" && gravityG === 0.0 && oxygenMargin < 9.0) return "Cool Flame";
  return "Sustained Burn";
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
  return 100.0 / (1.0 + Math.exp(-(margin - 4.0) / 3.0));
}

export function riskBand(r: number): RiskBand {
  if (r < 25) return "LOW";
  if (r < 50) return "ELEVATED";
  if (r < 75) return "HIGH";
  return "CRITICAL";
}

// ---------------------------------------------------------------- illustrative flame appearance (flame branch)
const FUEL_T: Readonly<Record<string, number>> = {
  PMMA: 1900,
  "Cotton-Fiberglass": 1750,
  Nomex: 1650,
  Heptane: 2000,
  Methanol: 1900,
};
const DILUENT_T: Readonly<Record<string, number>> = { N2: 0, CO2: -120, He: -20, Ar: 40 };
export const SOOTINESS: Readonly<Record<string, number>> = {
  Heptane: 0.92,
  PMMA: 0.78,
  "Cotton-Fiberglass": 0.58,
  Nomex: 0.32,
  Methanol: 0,
};

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function toCabinConfig(p: FlameParams): CabinConfig {
  return {
    oxygen_pct: p.oxygen_pct,
    pressure_kpa: p.pressure_kpa,
    flow_velocity_cm_s: p.flow_velocity_cm_s,
    gravity_g: p.gravity_g,
    fuel_material: p.fuel_material,
    diluent_gas: p.diluent_gas,
  };
}

export function computePhysics(p: FlameParams): FlamePhysics {
  const cfg = toCabinConfig(p);
  const uBuoyant = buoyantVelocity(p.gravity_g, p.pressure_kpa);
  const uEff = effectiveVelocity(p.flow_velocity_cm_s, p.gravity_g, p.pressure_kpa);
  const [margin, loi] = oxygenMargin(cfg);
  const regime = predictRegime(p.fuel_material, p.gravity_g, margin);
  const r = risk(cfg);

  const buoyFrac = clamp(uBuoyant / 30, 0, 1);
  let tempK = (FUEL_T[p.fuel_material] ?? 1800) + 12 * clamp(p.oxygen_pct - 21, -15, 40);
  tempK += DILUENT_T[p.diluent_gas] ?? 0;
  tempK -= 80 * (1 - buoyFrac);
  if (regime === "Cool Flame") tempK = 650 + 2 * (p.oxygen_pct - 21);
  tempK = clamp(tempK, 500, 3200);

  const pressureScale = clamp(Math.pow(101.3 / Math.max(p.pressure_kpa, 1), 0.18), 0.78, 1.32);
  let sizeFactor = clamp(0.75 + margin / 22, 0.6, 1.32) * pressureScale;
  if (regime === "Cool Flame") sizeFactor *= 1.1;
  if (regime === "Self-Extinguished" || regime === "No Ignition") sizeFactor = Math.min(sizeFactor, 0.8);

  return { uBuoyant, uEff, loi, margin, regime, riskIndex: r, riskBand: riskBand(r), tempK, sizeFactor };
}
