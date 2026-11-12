"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useApiMode } from "@/lib/api-mode/api-mode-context";

// One worker start per page load, even when effects run twice (React StrictMode in dev).
let workerStart: Promise<unknown> | null = null;

function startWorker() {
  workerStart ??= import("./browser").then(({ worker }) => worker.start({ onUnhandledRequest: "bypass" }));
  return workerStart;
}

/** Renders children only once the API mode is known and, in mock mode, the MSW worker is running. */
export function MockGate({ children }: { children: React.ReactNode }) {
  const { mode, resolved } = useApiMode();
  const [workerReady, setWorkerReady] = useState(false);

  useEffect(() => {
    if (!resolved || mode !== "mock") return;
    let active = true;
    startWorker()
      .then(() => {
        if (active) setWorkerReady(true);
      })
      .catch((e: unknown) => console.error("[EMBER] Failed to start the mock API worker", e));
    return () => {
      active = false;
    };
  }, [resolved, mode]);

  const ready = resolved && (mode === "live" || workerReady);
  if (ready) return children;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" label={resolved ? "Starting mock API…" : "Loading…"} />
    </div>
  );
}
