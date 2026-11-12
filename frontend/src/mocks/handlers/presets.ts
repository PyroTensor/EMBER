import { http } from "msw";
import type { Preset } from "@/lib/api/types";
import presetsFixture from "../fixtures/presets.json";
import { respond } from "../scenarios";

export const presetHandlers = [
  http.get("*/api/presets", ({ request }) =>
    respond<Preset[]>(() => presetsFixture as Preset[], () => [], request),
  ),
];
