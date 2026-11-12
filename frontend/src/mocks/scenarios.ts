import { delay, HttpResponse, type JsonBodyType } from "msw";

export type Scenario = "normal" | "slow" | "error" | "empty" | "offline";

const SCENARIOS: readonly Scenario[] = ["slow", "error", "empty", "offline"];
const LATENCY_MS = 120;
const SLOW_LATENCY_MS = 1500;

/**
 * Active mock scenario from `?scenario=slow|error|empty|offline`. Checks the request URL first, then the
 * page URL (MSW browser handlers run in the page, so `window.location` is the app route).
 */
export function currentScenario(request?: Request): Scenario {
  const fromRequest = request ? new URL(request.url).searchParams.get("scenario") : null;
  const fromPage =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("scenario") : null;
  const value = fromRequest ?? fromPage;
  return SCENARIOS.find((s) => s === value) ?? "normal";
}

/**
 * Build a mock response with realistic latency, honouring the active scenario:
 * offline → network error, error → 500 envelope, empty → `empty()` (when given), otherwise `build()`.
 */
export async function respond<T>(build: () => T, empty?: () => T, request?: Request): Promise<Response> {
  const scenario = currentScenario(request);
  if (scenario === "offline") return HttpResponse.error();

  await delay(scenario === "slow" ? SLOW_LATENCY_MS : LATENCY_MS);

  if (scenario === "error") {
    return HttpResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Mock scenario: forced server error", details: null } },
      { status: 500 },
    );
  }
  const body = scenario === "empty" && empty ? empty() : build();
  return HttpResponse.json(body as JsonBodyType);
}
