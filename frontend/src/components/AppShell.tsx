"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { DataModeProvider, useDataMode } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/cabin", label: "Cabin Configurator" },
  { href: "/twin", label: "Flame Twin" },
  { href: "/ranking", label: "Ranking & Telemetry" },
  { href: "/copilot", label: "SI Co-Pilot" },
];

function TopBar() {
  const {
    useMock,
    setUseMock,
    connectionState,
    health,
    offlineError,
    refreshHealth,
    apiBaseUrl,
  } = useDataMode();

  const statusDot =
    connectionState === "LIVE"
      ? "bg-emerald-500"
      : connectionState === "MOCK"
        ? "bg-amber-500"
        : "bg-rose-500";

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-900 bg-black">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6 font-mono text-xs text-zinc-500">
          <span>SCHEMA {health?.schema_version ?? "v1"}</span>
          <span>RUNS {health?.test_runs ?? 50}</span>
          <span>CHUNKS {health?.chunks ?? 35}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className=" inline-flex rounded-md border border-zinc-800 bg-zinc-950 p-0.5 font-mono text-xs">
            <button
              type="button"
              onClick={() => setUseMock(false)}
              className={`rounded px-2.5 py-1 transition ${
                !useMock ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Live
            </button>
            <button
              type="button"
              onClick={() => setUseMock(true)}
              className={`rounded px-2.5 py-1 transition ${
                useMock ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Mock
            </button>
          </div>

          <div className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-mono text-xs text-zinc-300">
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
            <span>{connectionState}</span>
          </div>

          <button
            type="button"
            onClick={() => void refreshHealth()}
            className="rounded-md border border-zinc-800 bg-zinc-950 p-1.5 text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-200"
            title="Refresh backend status"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {connectionState === "OFFLINE" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-900 bg-zinc-950 px-6 py-2 text-xs text-zinc-400">
          <span>
            Backend at <code className="font-mono text-zinc-200">{apiBaseUrl}</code> unreachable (
            {offlineError ?? "connection refused"}). Using local mock fallback.
          </span>
          <div className="flex items-center gap-2 font-mono">
            <button
              type="button"
              onClick={() => setUseMock(true)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-200 hover:bg-zinc-800"
            >
              Use Mock Mode
            </button>
            <button
              type="button"
              onClick={() => void refreshHealth()}
              className="rounded border border-zinc-800 px-2.5 py-1 text-zinc-400 hover:text-zinc-200"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-col border-b border-zinc-900 bg-black md:w-56 md:shrink-0 md:border-r md:border-b-0">
      <div className="border-b border-zinc-900 px-5 py-4">
        <Link href="/" className="flex items-baseline justify-between">
          <span className="font-mono text-base font-semibold tracking-tight text-white">
            EMBER
          </span>
          <span className="font-mono text-[11px] text-zinc-500">NASA PSI</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-zinc-900 font-medium text-white"
                  : "text-zinc-400 hover:bg-zinc-950 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-900 px-5 py-3 font-mono text-[11px] text-zinc-600">
        NASA-STD-6001B
      </div>
    </aside>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DataModeProvider>
      <div className="flex min-h-screen flex-col bg-black text-zinc-100 md:flex-row">
        <SidebarNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
        </div>
      </div>
    </DataModeProvider>
  );
}
