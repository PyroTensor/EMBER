import type { Metadata } from "next";
import { TwinView } from "@/features/twin";

export const metadata: Metadata = { title: "Flame Twin" };

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <header className="space-y-1">
        <p className="font-mono text-[11px] tracking-wide text-muted">MODULE 02</p>
        <h1 className="text-xl font-semibold">Flame Twin</h1>
        <p className="text-sm text-muted">Multi-gravity and atmosphere flame morphology simulator</p>
      </header>
      <TwinView />
    </div>
  );
}
