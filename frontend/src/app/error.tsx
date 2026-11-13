"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

// Route error boundary. Next 16 passes `error: unknown` and `retry()` (re-fetch + re-render the segment).
export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <ErrorState title="Something went wrong on this page" error={error} onRetry={retry} />
    </div>
  );
}
