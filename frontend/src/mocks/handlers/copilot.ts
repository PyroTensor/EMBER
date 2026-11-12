import { http } from "msw";
import type { AskRequest, AskResponse, TestRunRecord } from "@/lib/api/types";
import { mockAsk } from "../engine/copilot";
import experimentsFixture from "../fixtures/experiments.json";
import { respond } from "../scenarios";
import { validateCabinConfig, validationErrorResponse, type FieldError } from "./cabin";

const RUNS = experimentsFixture as unknown as TestRunRecord[];
const QUESTION_MAX = 2000; // backend AskRequest.question: 1–2000 chars

function validateAsk(body: unknown): { req: AskRequest } | { errors: FieldError[] } {
  if (typeof body !== "object" || body === null) {
    return { errors: [{ loc: ["body"], msg: "Input should be a valid object", type: "model_type" }] };
  }
  const raw = body as Record<string, unknown>;
  const errors: FieldError[] = [];
  const q = raw.question;
  if (typeof q !== "string" || q.length < 1 || q.length > QUESTION_MAX) {
    errors.push({ loc: ["body", "question"], msg: `String should have 1 to ${QUESTION_MAX} characters`, type: "string_length" });
  }
  let scenario: AskRequest["scenario"];
  if (raw.scenario !== undefined && raw.scenario !== null) {
    const cfg = validateCabinConfig(raw.scenario, ["body", "scenario"]);
    if ("errors" in cfg) errors.push(...cfg.errors);
    else scenario = cfg.cfg;
  }
  return errors.length ? { errors } : { req: { question: q as string, scenario } };
}

export const copilotHandlers = [
  // POST /api/copilot/ask: canned, cited answer from the TS ranker (trace_id "mock-<n>").
  http.post("*/api/copilot/ask", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    const result = validateAsk(body);
    if ("errors" in result) return validationErrorResponse(result.errors);
    return respond<AskResponse>(() => mockAsk(result.req, RUNS), undefined, request);
  }),
];
