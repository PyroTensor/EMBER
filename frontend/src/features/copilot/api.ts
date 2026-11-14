import { apiFetch } from "@/lib/api/client";
import type {
  AskRequest,
  AskResponse,
  DocumentDetail,
  DocumentSummary,
} from "@/lib/api/types";

/** The RAG graph may call an LLM several times (rewrites), so allow more than the default 15 s. */
export const ASK_TIMEOUT_MS = 35_000;

/** POST /api/copilot/ask */
export const askCopilot = (req: AskRequest, signal?: AbortSignal) =>
  apiFetch<AskResponse>("/api/copilot/ask", {
    method: "POST",
    body: req,
    timeoutMs: ASK_TIMEOUT_MS,
    signal,
  });

/** GET /api/documents */
export const listDocuments = (signal?: AbortSignal) =>
  apiFetch<DocumentSummary[]>("/api/documents", { signal });

/** GET /api/documents/{doc_id} */
export const getDocument = (docId: string, signal?: AbortSignal) =>
  apiFetch<DocumentDetail>(`/api/documents/${encodeURIComponent(docId)}`, {
    signal,
  });
