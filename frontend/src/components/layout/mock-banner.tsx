"use client";

import { FlaskConical } from "lucide-react";
import { useApiMode } from "@/lib/api-mode/api-mode-context";

/** Sticky notice shown on every page while the app runs against the mock API. */
export function MockBanner() {
  const { mode } = useApiMode();
  if (mode !== "mock") return null;

  return (
    <div
      role="note"
      className="flex items-center justify-center gap-2 border-b border-mock/30 bg-mock/10 px-4 py-1.5 text-center font-mono text-[11px] tracking-wide text-mock"
    >
      <FlaskConical aria-hidden className="size-3.5 shrink-0" />
      <span>MOCK DATA: proxy values, not from the backend</span>
    </div>
  );
}
