import type { HttpHandler } from "msw";
import { cabinHandlers } from "./cabin";
import { experimentHandlers } from "./experiments";
import { healthHandlers } from "./health";
import { presetHandlers } from "./presets";

/** All mock API handlers. */
export const handlers: HttpHandler[] = [
  ...healthHandlers,
  ...presetHandlers,
  ...cabinHandlers,
  ...experimentHandlers,
];
