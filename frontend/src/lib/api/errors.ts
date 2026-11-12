/** Every failure from apiFetch is an ApiError. status 0 means the request never got an HTTP response. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details ?? null;
  }

  /** True for transport failures (backend unreachable or timed out), i.e. no HTTP response. */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

const FRIENDLY: Record<string, string> = {
  NETWORK_ERROR: "Can't reach the EMBER backend. Check that the API is running, or switch to mock mode.",
  TIMEOUT: "The backend took too long to respond. Try again.",
  VALIDATION_ERROR: "The request was rejected: some values are out of range or invalid.",
  UPSTREAM_TIMEOUT: "The AI service took too long to answer. Try again in a moment.",
  UPSTREAM_UNAVAILABLE: "The AI service is unavailable right now. Try again later.",
};

/** A user-facing message for any thrown value. */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) return FRIENDLY[e.code] ?? (e.message || `Request failed (${e.status})`);
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong.";
}
