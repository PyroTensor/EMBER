import { env } from "@/lib/config/env";
import { ApiError } from "./errors";

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  /** Serialized as JSON. */
  body?: unknown;
  timeoutMs?: number;
}

/**
 * The only HTTP path in the app. Throws ApiError on any failure and NEVER returns mock data:
 * in mock mode MSW answers these same requests at the network level.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, timeoutMs = 15_000, headers, signal, ...rest } = options;
  const timeout = AbortSignal.timeout(timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}${path}`, {
      ...rest,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (e) {
    if (timeout.aborted) {
      throw new ApiError(0, "TIMEOUT", `No response within ${timeoutMs / 1000}s`, null);
    }
    // Caller-initiated abort (e.g. React Query cancellation): propagate unchanged.
    if (signal?.aborted) throw e;
    throw new ApiError(0, "NETWORK_ERROR", "Backend unreachable", null);
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string; details?: unknown };
    } | null;
    const err = payload?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "HTTP_ERROR",
      err?.message ?? (res.statusText || `HTTP ${res.status}`),
      err?.details,
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

type QueryValue = string | number | boolean | null | undefined;

/** `{a: 1, b: undefined}` → `"?a=1"`; empty → `""`. Skips null, undefined and empty strings. */
export function toQuery<T extends object>(params: T): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, QueryValue][]) {
    if (value === undefined || value === null || value === "") continue;
    search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
