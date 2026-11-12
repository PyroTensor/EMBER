import { http, HttpResponse } from "msw";
import type { RankRequest, RankResponse, RankWeights, TestRunRecord } from "@/lib/api/types";
import { DEFAULT_WEIGHTS, rankMock } from "../engine/ranker";
import experimentsFixture from "../fixtures/experiments.json";
import { respond } from "../scenarios";
import { validateCabinConfig, validationErrorResponse, type FieldError } from "./cabin";

const RUNS = experimentsFixture as unknown as TestRunRecord[];
const STRING_FILTERS = ["program", "fuel_material", "combustion_regime"] as const;
const GRAVITY_TOLERANCE = 0.01; // same as the backend repository
const WEIGHT_KEYS = ["similarity", "completeness", "criticality"] as const;
const LIMIT_MIN = 1;
const LIMIT_MAX = 50; // backend RankRequest: limit 1–50

function validationError(message: string) {
  return HttpResponse.json(
    { error: { code: "VALIDATION_ERROR", message, details: null } },
    { status: 422 },
  );
}

/** Backend-shaped RankRequest validation (config bounds, weights ≥ 0, integer limit 1–50). */
function validateRankRequest(body: unknown): { req: RankRequest } | { errors: FieldError[] } {
  if (typeof body !== "object" || body === null) {
    return { errors: [{ loc: ["body"], msg: "Input should be a valid object", type: "model_type" }] };
  }
  const raw = body as Record<string, unknown>;
  const errors: FieldError[] = [];

  const cfg = validateCabinConfig(raw.config, ["body", "config"]);
  if ("errors" in cfg) errors.push(...cfg.errors);

  const weights: RankWeights = { ...DEFAULT_WEIGHTS };
  if (raw.weights !== undefined && raw.weights !== null) {
    const w = raw.weights as Record<string, unknown>;
    for (const key of WEIGHT_KEYS) {
      if (w[key] === undefined) continue;
      const v = w[key];
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
        errors.push({ loc: ["body", "weights", key], msg: "Input should be a number ≥ 0", type: "greater_than_equal" });
      } else {
        weights[key] = v;
      }
    }
  }

  const limit = raw.limit ?? 10;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < LIMIT_MIN || limit > LIMIT_MAX) {
    errors.push({ loc: ["body", "limit"], msg: `Input should be an integer between ${LIMIT_MIN} and ${LIMIT_MAX}`, type: "int_range" });
  }

  if (errors.length || "errors" in cfg) return { errors };
  return { req: { config: cfg.cfg, weights, limit: limit as number } };
}

export const experimentHandlers = [
  // GET /api/experiments?program=&fuel_material=&combustion_regime=&gravity_g=
  http.get("*/api/experiments", ({ request }) => {
    const params = new URL(request.url).searchParams;

    const gravityParam = params.get("gravity_g");
    const gravity = gravityParam === null ? null : Number(gravityParam);
    if (gravity !== null && !(gravity >= 0 && gravity <= 1)) {
      return validationError("gravity_g must be a number between 0 and 1");
    }

    const filtered = () =>
      RUNS.filter(
        (run) =>
          STRING_FILTERS.every((key) => {
            const want = params.get(key);
            return want === null || run[key] === want;
          }) &&
          (gravity === null || Math.abs(run.gravity_g - gravity) < GRAVITY_TOLERANCE),
      );

    return respond<TestRunRecord[]>(filtered, () => [], request);
  }),

  // POST /api/experiments/rank: scored by the TS engine (same formulas as the backend ranker).
  http.post("*/api/experiments/rank", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    const result = validateRankRequest(body);
    if ("errors" in result) return validationErrorResponse(result.errors);
    return respond<RankResponse>(
      () => rankMock(RUNS, result.req),
      () => ({ weights: result.req.weights, results: [] }),
      request,
    );
  }),
];
