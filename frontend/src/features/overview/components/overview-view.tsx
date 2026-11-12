"use client";

import { MissionKpis } from "./mission-kpis";
import { ModuleCards } from "./module-cards";

export function OverviewView() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-8">
      <header className="space-y-1">
        <p className="font-mono text-[11px] tracking-wide text-muted">MISSION CONTROL</p>
        <h1 className="text-xl font-semibold">Microgravity fire safety at a glance</h1>
        <p className="max-w-2xl text-sm text-muted">
          EMBER turns NASA combustion experiments into cabin fire-risk estimates, flame visualisations, ranked
          evidence and grounded answers.
        </p>
      </header>
      <MissionKpis />
      <ModuleCards />
    </div>
  );
}
