import { http, HttpResponse } from "msw";
import type { CabinConfig, CabinEvaluation, DiluentGas, FuelMaterial } from "@/lib/api/types";
import { evaluateCabinMock } from "../engine/risk";
import { respond } from "../scenarios";

// Same bounds as contracts/schema_v1.json and the backend CabinConfig model.
const BOUNDS = {
  oxygen_pct: [10, 60],
  pressure_kpa: [20, 150],
  flow_velocity_cm_s: [0, 50],
  gravity_g: [0, 1],
} as const satisfies Partial<Record<keyof CabinConfig, readonly [number, number]>>;

const VALID_FUEL_MATERIALS = new Set<FuelMaterial>([
  "PMMA",
  "Cotton-Fiberglass",
  "Nomex",
  "Heptane",
  "Methanol",
  "Ethylene",
  "Ethane",
  "Propane",
  "Butane",
]);

const VALID_DILUENT_GASES = new Set<DiluentGas>(["N2", "CO2", "He", "Ar"]);

export interface FieldError {
  loc: string[];
  msg: string;
  type: string;
}

/** 422 envelope shaped like the backend's (pydantic-style `details` list). */
export function validationErrorResponse(errors: FieldError[]) {
  return HttpResponse.json(
    { error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: errors } },
    { status: 422 },
  );
}

/** Backend-shaped CabinConfig validation. `loc` is the path prefix of the config inside the body. */
export function validateCabinConfig(
  body: unknown,
  loc: string[] = ["body"],
): { cfg: CabinConfig } | { errors: FieldError[] } {
  if (typeof body !== "object" || body === null) {
    return { errors: [{ loc, msg: "Input should be a valid object", type: "model_type" }] };
  }
  const cfg = body as Record<string, unknown>;
  const errors: FieldError[] = [];
  for (const [field, [min, max]] of Object.entries(BOUNDS)) {
    const v = cfg[field];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      errors.push({ loc: [...loc, field], msg: "Input should be a valid number", type: "float_type" });
    } else if (v < min || v > max) {
      errors.push({
        loc: [...loc, field],
        msg: `Input should be between ${min} and ${max}`,
        type: v < min ? "greater_than_equal" : "less_than_equal",
      });
    }
  }
  if (typeof cfg.fuel_material !== "string" || !VALID_FUEL_MATERIALS.has(cfg.fuel_material as FuelMaterial)) {
    errors.push({ loc: [...loc, "fuel_material"], msg: "Unknown fuel material", type: "enum" });
  }
  if (typeof cfg.diluent_gas !== "string" || !VALID_DILUENT_GASES.has(cfg.diluent_gas as DiluentGas)) {
    errors.push({ loc: [...loc, "diluent_gas"], msg: "Unknown diluent gas", type: "enum" });
  }
  return errors.length ? { errors } : { cfg: cfg as unknown as CabinConfig };
}

export const cabinHandlers = [
  // POST /api/evaluate-cabin: computed by the TS engine (same math as the backend), not a static blob.
  http.post("*/api/evaluate-cabin", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    const result = validateCabinConfig(body);
    if ("errors" in result) return validationErrorResponse(result.errors);
    return respond<CabinEvaluation>(() => evaluateCabinMock(result.cfg), undefined, request);
  }),
];
