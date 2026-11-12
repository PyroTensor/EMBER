import type { HttpHandler } from "msw";
import { experimentHandlers } from "./experiments";
import { healthHandlers } from "./health";

/** All mock API handlers. */
export const handlers: HttpHandler[] = [...healthHandlers, ...experimentHandlers];
