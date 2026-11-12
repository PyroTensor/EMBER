import type { Metadata } from "next";
import { Construction } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Flame Twin" };

// Placeholder until the feature view lands.
export default function Page() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <header className="space-y-1">
        <p className="font-mono text-[11px] tracking-wide text-muted">MODULE 02</p>
        <h1 className="text-xl font-semibold">Flame Twin</h1>
        <p className="text-sm text-muted">Compare a buoyant 1g flame with a spherical 0g flame and explore the HVAC ventilation paradox.</p>
      </header>
      <EmptyState icon={Construction} title="Coming soon" description="This module is not built yet." />
    </div>
  );
}
