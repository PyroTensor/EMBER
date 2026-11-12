"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getExperiments, getPresets, useDataMode } from "@/lib/api";
import type { Preset, TestRun } from "@/lib/types";

const MODULES = [
  {
    code: "01",
    title: "Cabin Configurator",
    href: "/cabin",
    description:
      "Evaluate O₂%, pressure, ventilation velocity, and gravity. Computes Limiting Oxygen Index (LOI) and exact Shapley risk attributions.",
  },
  {
    code: "02",
    title: "Flame Digital Twin",
    href: "/twin",
    description:
      "Simulate 3D volumetric flame morphology across variable gravity, cabin atmospheres, fuel geometries, and airflow regimes.",
  },
  {
    code: "03",
    title: "Ranking & Telemetry",
    href: "/ranking",
    description:
      "Score BASS-II, SoFIE, FLEX, and ACME test runs by similarity, completeness, and criticality with time-series curves.",
  },
  {
    code: "04",
    title: "SI Co-Pilot",
    href: "/copilot",
    description:
      "LangGraph question-answering pipeline with [DOC, page] and [EXP] citation checks across test runs and research summaries.",
  },
];

export default function MissionOverviewPage() {
  const { useMock, health } = useDataMode();
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);

  useEffect(() => {
    void getExperiments().then(setRuns);
    void getPresets().then(setPresets);
  }, [useMock]);

  const sustainedCount = runs.filter((r) => r.combustion_regime === "Sustained Burn").length;
  const coolFlameCount = runs.filter((r) => r.combustion_regime === "Cool Flame").length;
  const extraKeyCount = health?.extra_telemetry_keys?.length ?? 10;

  return (
    <div className="space-y-10">
      <section className="space-y-2 border-b border-zinc-900 pb-6">
        <p className="font-mono text-xs text-zinc-500">
          EMBER – EXPLORATION OF MICROGRAVITY BURNING THROUGH EXPERIMENTAL RESEARCH
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Microgravity Fire Safety Console
        </h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Evaluate spacecraft atmosphere flammability, compare 1g and 0g flame behavior, rank NASA
          PSI experiments, and query citation-verified literature.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-900 bg-zinc-900 sm:grid-cols-4">
        <div className="bg-black p-4">
          <div className="font-mono text-[11px] text-zinc-500">TEST RUNS</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-white">
            {runs.length || health?.test_runs || 50}
          </div>
        </div>
        <div className="bg-black p-4">
          <div className="font-mono text-[11px] text-zinc-500">SUSTAINED / COOL FLAME</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-white">
            {sustainedCount} / {coolFlameCount}
          </div>
        </div>
        <div className="bg-black p-4">
          <div className="font-mono text-[11px] text-zinc-500">MISSION PRESETS</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-white">
            {presets.length || 5}
          </div>
        </div>
        <div className="bg-black p-4">
          <div className="font-mono text-[11px] text-zinc-500">EXTRA TELEMETRY KEYS</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-white">{extraKeyCount}</div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {MODULES.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="group flex flex-col justify-between rounded-lg border border-zinc-900 bg-zinc-950 p-5 transition hover:border-zinc-700"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-500">{mod.code}</span>
                <ArrowUpRight className="h-4 w-4 text-zinc-600 transition group-hover:text-white" />
              </div>
              <h2 className="mt-2 text-base font-medium text-white">{mod.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{mod.description}</p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
