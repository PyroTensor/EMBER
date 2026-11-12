"use client";

import React from "react";
import { FlameSimulator } from "@/components/flame/FlameSimulator";

export default function FlameDigitalTwinPage() {
  return (
    <div className="space-y-8">
      <div className="border-b border-zinc-900 pb-5">
        <p className="font-mono text-xs text-zinc-500">02 / FLAME DIGITAL TWIN</p>
        <h1 className="mt-1 text-xl font-semibold text-white">
          1g Buoyant vs. 0g Diffusion Flame Morphology
        </h1>
      </div>

      <FlameSimulator />

      <div className="border-t border-zinc-900 pt-6">
        <p className="font-mono text-xs text-zinc-500">REFERENCE MORPHOLOGY</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1G Panel */}
        <div className="space-y-4 rounded-lg border border-zinc-900 bg-zinc-950 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">1.0g Buoyant Teardrop Flame</h2>
            <span className="font-mono text-xs text-zinc-500">u_buoyant ≈ 30 cm/s</span>
          </div>
          <p className="text-xs leading-relaxed text-zinc-400">
            Buoyancy accelerates hot combustion products upward, drawing fresh oxygen into the base
            and forming a soot-luminous teardrop plume.
          </p>

          <div className="flex items-center justify-center rounded border border-zinc-900 bg-black p-4">
            <svg
              viewBox="0 0 360 260"
              className="h-60 w-full max-w-[360px]"
              role="img"
              aria-label="1G Buoyant Teardrop Flame Diagram"
            >
              <line x1="180" y1="20" x2="180" y2="240" stroke="#27272a" strokeDasharray="3 3" />
              <line x1="40" y1="195" x2="320" y2="195" stroke="#27272a" strokeDasharray="3 3" />

              {/* Outer Flame Sheet */}
              <path
                d="M 180 35 C 215 95, 228 155, 212 190 C 202 212, 158 212, 148 190 C 132 155, 145 95, 180 35 Z"
                fill="#f97316"
                fillOpacity="0.16"
                stroke="#f97316"
                strokeWidth="1.5"
              />

              {/* Inner Soot Core */}
              <path
                d="M 180 75 C 198 115, 205 155, 195 182 C 188 196, 172 196, 165 182 C 155 155, 162 115, 180 75 Z"
                fill="#facc15"
                fillOpacity="0.22"
                stroke="#eab308"
                strokeWidth="1"
              />

              {/* Fuel Sample */}
              <circle cx="180" cy="195" r="7" fill="#18181b" stroke="#a1a1aa" strokeWidth="1.5" />

              {/* Upward Plume Vectors */}
              <g stroke="#71717a" strokeWidth="1.2">
                <line x1="115" y1="185" x2="115" y2="85" />
                <polyline points="111,92 115,84 119,92" fill="none" />
                <line x1="245" y1="185" x2="245" y2="85" />
                <polyline points="241,92 245,84 249,92" fill="none" />
              </g>

              <text x="16" y="30" fill="#a1a1aa" fontSize="10" fontFamily="monospace">
                ~1850 K (Soot Plume)
              </text>
              <text x="16" y="232" fill="#71717a" fontSize="10" fontFamily="monospace">
                Upward Buoyant Convection
              </text>
            </svg>
          </div>
        </div>

        {/* 0G Panel */}
        <div className="space-y-4 rounded-lg border border-zinc-900 bg-zinc-950 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">0.0g Spherical Diffusion &amp; Cool Flame</h2>
            <span className="font-mono text-xs text-zinc-500">u_buoyant = 0 cm/s</span>
          </div>
          <p className="text-xs leading-relaxed text-zinc-400">
            Without buoyancy, oxygen reaches the reaction zone by slow radial diffusion or cabin
            ventilation. Large heptane droplets can radiatively extinguish into a ~650 K cool flame.
          </p>

          <div className="flex items-center justify-center rounded border border-zinc-900 bg-black p-4">
            <svg
              viewBox="0 0 360 260"
              className="h-60 w-full max-w-[360px]"
              role="img"
              aria-label="0G Spherical Diffusion Flame Diagram"
            >
              <line x1="180" y1="20" x2="180" y2="240" stroke="#27272a" strokeDasharray="3 3" />
              <line x1="40" y1="135" x2="320" y2="135" stroke="#27272a" strokeDasharray="3 3" />

              {/* Outer Hot Diffusion Ring */}
              <circle
                cx="180"
                cy="135"
                r="76"
                fill="#38bdf8"
                fillOpacity="0.1"
                stroke="#38bdf8"
                strokeWidth="1.5"
              />

              {/* Inner Cool Flame Shell */}
              <circle
                cx="180"
                cy="135"
                r="44"
                fill="none"
                stroke="#a1a1aa"
                strokeWidth="1.2"
                strokeDasharray="5 4"
              />

              {/* Central Droplet */}
              <circle cx="180" cy="135" r="9" fill="#18181b" stroke="#e4e4e7" strokeWidth="1.5" />

              {/* Standoff Radius Line */}
              <line x1="180" y1="135" x2="256" y2="135" stroke="#71717a" strokeWidth="1" />
              <text x="192" y="128" fill="#a1a1aa" fontSize="9.5" fontFamily="monospace">
                R_f
              </text>

              <text x="16" y="30" fill="#38bdf8" fontSize="10" fontFamily="monospace">
                Hot Diffusion Front (1300–1600 K)
              </text>
              <text x="16" y="46" fill="#a1a1aa" fontSize="10" fontFamily="monospace">
                --- Cool Flame Shell (600–800 K)
              </text>
              <text x="16" y="232" fill="#71717a" fontSize="10" fontFamily="monospace">
                Isotropic Molecular Diffusion
              </text>
            </svg>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-dashed border-zinc-800 p-4 font-mono text-xs text-zinc-500">
          TODO(squad3-B): Two-stage hot-to-cool flame transition scrubber
        </div>
        <div className="rounded-lg border border-dashed border-zinc-800 p-4 font-mono text-xs text-zinc-500">
          TODO(squad3-B): HVAC ventilation paradox airflow simulator
        </div>
      </div>
    </div>
  );
}
