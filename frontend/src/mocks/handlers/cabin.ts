import { http, HttpResponse } from "msw";
import type { CabinConfig, CabinEvaluation } from "@/lib/api/types";
import { MATERIAL_BASE_LOI } from "../engine/combustion";
import { evaluateCabinMock } from "../engine/risk";
import { respond } from "../scenarios";

// Same bounds as contracts/schema_v1.json and the backend CabinConfig model.
const BOUNDS = {
  oxygen_pct: [15, 40],
  pressure_kpa: [40, 101.3],
  flow_velocity_cm_s: [0, 50],
  gravity_g: [0, 1],
} as const satisfies Partial<Record<keyof CabinConfig, readonly [number, number]>>;

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
  if (typeof cfg.fuel_material !== "string" || !(cfg.fuel_material in MATERIAL_BASE_LOI)) {
    errors.push({ loc: [...loc, "fuel_material"], msg: "Unknown fuel material", type: "enum" });
  }
  if (typeof cfg.diluent_gas !== "string") {
    errors.push({ loc: [...loc, "diluent_gas"], msg: "Input should be a valid string", type: "string_type" });
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
