import { http } from "msw";
import type { Health } from "@/lib/api/types";
import healthFixture from "../fixtures/health.json";
import { respond } from "../scenarios";

export const healthHandlers = [
  http.get("*/api/health", ({ request }) =>
    respond<Health>(() => ({ ...(healthFixture as Health), llm_provider: "mock" }), undefined, request),
  ),
];
