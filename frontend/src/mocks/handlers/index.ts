import type { HttpHandler } from "msw";
import { healthHandlers } from "./health";

/** All mock API handlers. */
export const handlers: HttpHandler[] = [...healthHandlers];
