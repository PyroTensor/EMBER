import type { Metadata } from "next";
import { Construction } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Ranking & Telemetry" };

// Placeholder until the feature view lands.
export default function Page() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <header className="space-y-1">
        <p className="font-mono text-[11px] tracking-wide text-muted">MODULE 03</p>
        <h1 className="text-xl font-semibold">Ranking & Telemetry</h1>
        <p className="text-sm text-muted">Rank test runs against a cabin scenario and inspect their telemetry.</p>
      </header>
      <EmptyState icon={Construction} title="Coming soon" description="This module is not built yet." />
    </div>
  );
}
