import type { HttpHandler } from "msw";
import { cabinHandlers } from "./cabin";
import { copilotHandlers } from "./copilot";
import { documentHandlers } from "./documents";
import { experimentHandlers } from "./experiments";
import { healthHandlers } from "./health";
import { presetHandlers } from "./presets";
import { telemetryHandlers } from "./telemetry";

/** All mock API handlers. */
export const handlers: HttpHandler[] = [
  ...healthHandlers,
  ...presetHandlers,
  ...cabinHandlers,
  ...experimentHandlers,
  ...telemetryHandlers,
  ...documentHandlers,
  ...copilotHandlers,
];
