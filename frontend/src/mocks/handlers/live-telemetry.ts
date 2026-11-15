import { http } from "msw";
import type {
  LiveSensorReadings,
  LiveStreamStatus,
  LiveTelemetryIngestRequest,
  LiveTelemetrySample,
  LiveTelemetryState,
  RankedExperiment,
  TestRunRecord,
} from "@/lib/api/types";
import { DEFAULT_WEIGHTS, rankRuns } from "../engine/ranker";
import { evaluateCabinMock } from "../engine/risk";
import experimentsFixture from "../fixtures/experiments.json";
import { respond } from "../scenarios";
import { type FieldError, validateCabinConfig, validationErrorResponse } from "./cabin";

const RUNS = experimentsFixture as unknown as TestRunRecord[];
const MAX_HISTORY = 120;
const ACTIVE_TTL_MS = 30_000;
const VALID_STATUSES = new Set<LiveStreamStatus>(["idle", "streaming", "paused", "completed"]);
const NON_NEGATIVE_SENSOR_FIELDS: readonly (keyof LiveSensorReadings)[] = [
  "flame_temp_k",
  "radiative_heat_flux_kw_m2",
  "flame_radius_mm",
];
const ALL_SENSOR_FIELDS: readonly (keyof LiveSensorReadings)[] = [
  "oxygen_pct_raw",
  "pressure_kpa_raw",
  "flow_velocity_cm_s_raw",
  "gravity_g_raw",
  ...NON_NEGATIVE_SENSOR_FIELDS,
];

interface MockLiveBuffer {
  status: LiveStreamStatus;
  sessionId: string | null;
  experimentName: string | null;
  updatedAt: string | null;
  seq: number;
  startedMs: number | null;
  lastFrameMs: number | null;
  history: LiveTelemetrySample[];
  topMatches: RankedExperiment[];
}

const buffer: MockLiveBuffer = {
  status: "idle",
  sessionId: null,
  experimentName: null,
  updatedAt: null,
  seq: 0,
  startedMs: null,
  lastFrameMs: null,
  history: [],
  topMatches: [],
};

function clearMockBuffer() {
  buffer.status = "idle";
  buffer.sessionId = null;
  buffer.experimentName = null;
  buffer.updatedAt = null;
  buffer.seq = 0;
  buffer.startedMs = null;
  buffer.lastFrameMs = null;
  buffer.history = [];
  buffer.topMatches = [];
}

function buildState(): LiveTelemetryState {
  const now = Date.now();
  const active =
    buffer.status === "streaming" &&
    buffer.lastFrameMs !== null &&
    now - buffer.lastFrameMs <= ACTIVE_TTL_MS;
  return {
    active,
    status: buffer.status,
    session_id: buffer.sessionId,
    experiment_name: buffer.experimentName,
    updated_at: buffer.updatedAt,
    sample_count: buffer.seq,
    latest: buffer.history[buffer.history.length - 1] ?? null,
    history: [...buffer.history],
    top_matches: [...buffer.topMatches],
  };
}

function validateIngestExtras(raw: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  if (raw.status != null && (typeof raw.status !== "string" || !VALID_STATUSES.has(raw.status as LiveStreamStatus))) {
    errors.push({ loc: ["body", "status"], msg: "Invalid stream status", type: "enum" });
  }
  if (raw.timestamp_s != null) {
    if (typeof raw.timestamp_s !== "number" || !Number.isFinite(raw.timestamp_s)) {
      errors.push({ loc: ["body", "timestamp_s"], msg: "Input should be a valid finite number", type: "float_type" });
    } else if (raw.timestamp_s < 0) {
      errors.push({
        loc: ["body", "timestamp_s"],
        msg: "Input should be greater than or equal to 0",
        type: "greater_than_equal",
      });
    }
  }
  if (raw.raw_sensors != null) {
    if (typeof raw.raw_sensors !== "object") {
      errors.push({ loc: ["body", "raw_sensors"], msg: "Input should be a valid object", type: "model_type" });
    } else {
      const sensors = raw.raw_sensors as Record<string, unknown>;
      for (const field of ALL_SENSOR_FIELDS) {
        const value = sensors[field];
        if (value == null) continue;
        if (typeof value !== "number" || !Number.isFinite(value)) {
          errors.push({
            loc: ["body", "raw_sensors", field],
            msg: "Input should be a valid finite number",
            type: "float_type",
          });
        } else if (NON_NEGATIVE_SENSOR_FIELDS.includes(field) && value < 0) {
          errors.push({
            loc: ["body", "raw_sensors", field],
            msg: "Input should be greater than or equal to 0",
            type: "greater_than_equal",
          });
        }
      }
    }
  }
  return errors;
}

export const liveTelemetryHandlers = [
  http.get("*/api/live-telemetry", async ({ request }) => {
    return respond<LiveTelemetryState>(
      buildState,
      () => ({
        active: false,
        status: "idle",
        session_id: null,
        experiment_name: null,
        updated_at: null,
        sample_count: 0,
        latest: null,
        history: [],
        top_matches: [],
      }),
      request,
    );
  }),

  http.post("*/api/live-telemetry", async ({ request }) => {
    const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") {
      return validationErrorResponse([
        {
          loc: ["body"],
          msg: "Input should be a valid object",
          type: "model_type",
        },
      ]);
    }
    const validated = validateCabinConfig(raw.config, ["body", "config"]);
    const extraErrors = validateIngestExtras(raw);
    if ("errors" in validated || extraErrors.length > 0) {
      return validationErrorResponse([
        ...("errors" in validated ? validated.errors : []),
        ...extraErrors,
      ]);
    }

    const req = raw as unknown as LiveTelemetryIngestRequest;
    const cfg = validated.cfg;
    const evaluation = evaluateCabinMock(cfg);
    const topMatches = rankRuns(RUNS, cfg, DEFAULT_WEIGHTS, 5);
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    if (req.reset) clearMockBuffer();
    if (buffer.startedMs === null) buffer.startedMs = nowMs;

    buffer.seq += 1;
    const timestampS =
      typeof req.timestamp_s === "number" && Number.isFinite(req.timestamp_s)
        ? Number(req.timestamp_s.toFixed(3))
        : Number(((nowMs - buffer.startedMs) / 1000).toFixed(3));

    if (req.session_id !== undefined && req.session_id !== null) buffer.sessionId = req.session_id;
    if (req.experiment_name !== undefined && req.experiment_name !== null)
      buffer.experimentName = req.experiment_name;
    buffer.status = req.status ?? "streaming";
    buffer.updatedAt = nowIso;
    buffer.lastFrameMs = nowMs;
    buffer.topMatches = topMatches;

    buffer.history.push({
      seq: buffer.seq,
      timestamp_s: timestampS,
      recorded_at: nowIso,
      phase: req.phase ?? null,
      event: req.event ?? null,
      config: cfg,
      raw_sensors: req.raw_sensors ?? null,
      evaluation,
    });
    if (buffer.history.length > MAX_HISTORY) {
      buffer.history.splice(0, buffer.history.length - MAX_HISTORY);
    }

    return respond<LiveTelemetryState>(buildState, undefined, request);
  }),

  http.post("*/api/live-telemetry/reset", async ({ request }) => {
    clearMockBuffer();
    return respond<LiveTelemetryState>(buildState, undefined, request);
  }),
];
