"use client";

import { Database, FileSearch, ListOrdered, type LucideIcon } from "lucide-react";
import type { Evidence } from "@/lib/api/types";

/** Known graph nodes, in display order. Unknown sources are listed after these. */
const SOURCES: Record<string, { label: string; icon: LucideIcon }> = {
  sql_tool: { label: "SQL tool", icon: Database },
  hybrid_retriever: { label: "Hybrid retriever", icon: FileSearch },
  scenario_ranker: { label: "Scenario ranker", icon: ListOrdered },
};
const ORDER = Object.keys(SOURCES);

function groupBySource(evidence: readonly Evidence[]): [string, Evidence[]][] {
  const groups = new Map<string, Evidence[]>();
  for (const ev of evidence) {
    const src = ev.source || "unknown";
    const list = groups.get(src);
    if (list) list.push(ev);
    else groups.set(src, [ev]);
  }
  const rank = (s: string) => (ORDER.includes(s) ? ORDER.indexOf(s) : ORDER.length);
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b));
}

function locator(ev: Evidence): string | null {
  if (ev.doc_id) return `${ev.doc_id}${ev.page != null ? ` p.${ev.page}` : ""}`;
  return ev.experiment_id ?? null;
}

/** Retrieved evidence grouped by the graph node that produced it, with retrieval scores. */
export function EvidenceList({ evidence }: { evidence: readonly Evidence[] }) {
  if (evidence.length === 0) {
    return <p className="text-xs text-muted">No evidence was retrieved for this question.</p>;
  }

  return (
    <div className="space-y-4">
      {groupBySource(evidence).map(([source, items]) => {
        const meta = SOURCES[source];
        const Icon = meta?.icon ?? FileSearch;
        return (
          <section key={source} aria-label={`${meta?.label ?? source} evidence`} className="space-y-2">
            <h4 className="flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-muted uppercase">
              <Icon aria-hidden className="size-3.5" />
              {meta?.label ?? source}
              <span className="text-muted/70">({items.length})</span>
            </h4>
            <ul className="space-y-2">
              {items.map((ev, i) => {
                const loc = locator(ev);
                return (
                  <li key={`${ev.id ?? "ev"}-${i}`} className="rounded-md border border-border bg-bg p-3">
                    <div className="flex items-baseline justify-between gap-3 font-mono text-xs">
                      <span className="min-w-0 truncate text-fg" title={ev.id}>
                        {ev.id ?? "—"}
                        {loc && loc !== ev.id ? <span className="ml-2 text-muted">{loc}</span> : null}
                      </span>
                      <span className="shrink-0 text-muted" title="Retrieval score">
                        {ev.score != null ? ev.score.toFixed(3) : "—"}
                      </span>
                    </div>
                    {ev.text ? (
                      <p className="mt-1.5 max-h-32 overflow-y-auto text-xs leading-relaxed whitespace-pre-line text-muted">
                        {ev.text}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
