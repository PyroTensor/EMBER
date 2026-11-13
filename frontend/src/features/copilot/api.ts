import { apiFetch } from "@/lib/api/client";
import type { AskRequest, AskResponse } from "@/lib/api/types";

/** The RAG graph may call an LLM several times (rewrites), so allow more than the default 15 s. */
export const ASK_TIMEOUT_MS = 35_000;

/** POST /api/copilot/ask */
export const askCopilot = (req: AskRequest, signal?: AbortSignal) =>
  apiFetch<AskResponse>("/api/copilot/ask", { method: "POST", body: req, timeoutMs: ASK_TIMEOUT_MS, signal });
