"use client";

import React from "react";
import { FlameSimulator } from "@/components/flame/FlameSimulator";

export default function FlameDigitalTwinPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-900 pb-5">
        <p className="font-mono text-xs text-zinc-500">02 / FLAME DIGITAL TWIN</p>
        <h1 className="mt-1 text-xl font-semibold text-white">
          Multi-Gravity &amp; Atmosphere Flame Morphology Simulator
        </h1>
      </div>

      <FlameSimulator />
    </div>
  );
}
