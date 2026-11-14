// Port of backend/app/domain/physics/combustion.py: keep formulas line-by-line equal.
import type { CombustionRegime } from "@/lib/api/types";

export const P0_KPA = 101.3;
export const DEFAULT_BASE_LOI = 18.0;

/** % O2 at 1g / 101.3 kPa / buoyant flow. */
export const MATERIAL_BASE_LOI: Readonly<Record<string, number>> = {
  PMMA: 17.5,
  "Cotton-Fiberglass": 18.5,
  Nomex: 27.0,
  Heptane: 13.5,
  Methanol: 15.5,
};
export const DILUENT_SHIFT: Readonly<Record<string, number>> = { N2: 0.0, CO2: 3.0, He: 2.0, Ar: -1.0 };

/** Characteristic buoyancy-induced velocity (cm/s); ~30 cm/s at 1g sea level. */
export function buoyantVelocity(gravityG: number, pressureKpa: number): number {
  return 30.0 * Math.sqrt((Math.max(gravityG, 0.0) * Math.max(pressureKpa, 0.0)) / P0_KPA);
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
  const base = MATERIAL_BASE_LOI[material] ?? DEFAULT_BASE_LOI;
  const u = effectiveVelocity(flowCmS, gravityG, pressureKpa);
  return base + flowLoiShift(u) + pressureLoiShift(pressureKpa) + (DILUENT_SHIFT[diluent] ?? 0.0);
}

export function predictRegime(material: string, gravityG: number, oxygenMargin: number): CombustionRegime {
  if (oxygenMargin < -2.0) return "No Ignition";
  if (oxygenMargin < 0.0) return "Self-Extinguished";
  if (material === "Heptane" && gravityG < 0.05 && oxygenMargin < 9.0) return "Cool Flame";
  return "Sustained Burn";
}
