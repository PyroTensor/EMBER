"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { useApiMode } from "@/lib/api-mode/api-mode-context";
import { env, type ApiMode } from "@/lib/config/env";

const OPTIONS = [
  { value: "live", label: "Live" },
  { value: "mock", label: "Mock" },
] as const satisfies readonly { value: ApiMode; label: string }[];

/** Live | Mock switch. Rendered only when NEXT_PUBLIC_ALLOW_MODE_TOGGLE=true; switching reloads the page. */
export function ApiModeToggle() {
  const { mode, setMode } = useApiMode();
  if (!env.allowModeToggle) return null;

  return (
    <SegmentedControl
      label="API mode"
      size="sm"
      value={mode}
      options={OPTIONS}
      onChange={(next) => {
        if (next !== mode) setMode(next);
      }}
    />
  );
}
