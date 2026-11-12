import { http, HttpResponse } from "msw";
import type { TestRunRecord } from "@/lib/api/types";
import experimentsFixture from "../fixtures/experiments.json";
import { respond } from "../scenarios";

const RUNS = experimentsFixture as unknown as TestRunRecord[];
const STRING_FILTERS = ["program", "fuel_material", "combustion_regime"] as const;
const GRAVITY_TOLERANCE = 0.01; // same as the backend repository

function validationError(message: string) {
  return HttpResponse.json(
    { error: { code: "VALIDATION_ERROR", message, details: null } },
    { status: 422 },
  );
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
];
