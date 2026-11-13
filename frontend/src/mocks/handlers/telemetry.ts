import { http, HttpResponse } from "msw";
import type { Telemetry } from "@/lib/api/types";
import telemetryFixture from "../fixtures/telemetry.json";
import { respond } from "../scenarios";

const SERIES = telemetryFixture as unknown as Record<string, Telemetry>;

export const telemetryHandlers = [
  // GET /api/telemetry/:id → stored series, or the backend's 404 envelope for unknown runs.
  http.get("*/api/telemetry/:id", ({ request, params }) => {
    const id = decodeURIComponent(String(params.id));
    const series = SERIES[id];
    if (!series) {
      return HttpResponse.json(
        {
          error: {
            code: "TELEMETRY_NOT_FOUND",
            message: `No telemetry for experiment '${id}'`,
            details: { experiment_id: id },
          },
        },
        { status: 404 },
      );
    }
    return respond<Telemetry>(() => series, undefined, request);
  }),
];
