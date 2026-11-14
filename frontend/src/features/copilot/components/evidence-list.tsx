"use client";

import {
  BookOpen,
  Database,
  ExternalLink,
  FileSearch,
  ListOrdered,
  type LucideIcon,
} from "lucide-react";
import type { DocumentSummary, Evidence } from "@/lib/api/types";
import { parseDocTag } from "../lib/citations";
import type { DocumentReaderTarget } from "./document-reader";

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
  const rank = (s: string) =>
    ORDER.includes(s) ? ORDER.indexOf(s) : ORDER.length;
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b));
}

function locator(ev: Evidence): string | null {
  if (ev.doc_id) return `${ev.doc_id}${ev.page != null ? ` p.${ev.page}` : ""}`;
  return ev.experiment_id ?? null;
}

function resolveDocTarget(ev: Evidence): DocumentReaderTarget | null {
  if (ev.doc_id) {
    return { docId: ev.doc_id.toUpperCase(), page: ev.page ?? undefined };
  }
  if (ev.id) {
    const parsed = parseDocTag(ev.id);
    if (parsed) return parsed;
  }
  return null;
}

interface EvidenceListProps {
  evidence: readonly Evidence[];
  documentsById?: ReadonlyMap<string, DocumentSummary>;
  onOpenDocument?: (target: DocumentReaderTarget) => void;
}

/** Retrieved evidence grouped by the graph node that produced it, with clickable links to read the source paper. */
export function EvidenceList({
  evidence,
  documentsById,
  onOpenDocument,
}: EvidenceListProps) {
  if (evidence.length === 0) {
    return (
      <p className="text-muted text-xs">
        No evidence was retrieved for this question.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groupBySource(evidence).map(([source, items]) => {
        const meta = SOURCES[source];
        const Icon = meta?.icon ?? FileSearch;
        return (
          <section
            key={source}
            aria-label={`${meta?.label ?? source} evidence`}
            className="space-y-2"
          >
            <h4 className="text-muted flex items-center gap-1.5 font-mono text-[11px] tracking-wide uppercase">
              <Icon aria-hidden className="size-3.5" />
              {meta?.label ?? source}
              <span>({items.length})</span>
            </h4>
            <ul className="space-y-2">
              {items.map((ev, i) => {
                const loc = locator(ev);
                const docTarget = resolveDocTarget(ev);
                const docMeta = docTarget
                  ? documentsById?.get(docTarget.docId)
                  : undefined;
                const primaryUrl = docMeta?.url ?? docMeta?.sources?.[0];

                return (
                  <li
                    key={`${ev.id ?? "ev"}-${i}`}
                    className="border-border bg-bg rounded-md border p-3 transition-colors hover:border-sky-400/40"
                  >
                    <div className="flex items-baseline justify-between gap-3 font-mono text-xs">
                      <span className="text-fg min-w-0 truncate" title={ev.id}>
                        {ev.id ?? "—"}
                        {loc && loc !== ev.id ? (
                          <span className="text-muted ml-2">{loc}</span>
                        ) : null}
                      </span>
                      <span
                        className="text-muted shrink-0"
                        title="Retrieval score"
                      >
                        {ev.score != null ? ev.score.toFixed(3) : "—"}
                      </span>
                    </div>

                    {docMeta?.title ? (
                      <p
                        className="mt-1 truncate text-xs font-medium text-sky-300/90"
                        title={docMeta.title}
                      >
                        {docMeta.title}
                      </p>
                    ) : null}

                    {ev.text ? (
                      <p className="text-muted mt-1.5 max-h-32 overflow-y-auto text-xs leading-relaxed whitespace-pre-line">
                        {ev.text}
                      </p>
                    ) : null}

                    {docTarget && onOpenDocument ? (
                      <div className="border-border/70 mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                        <button
                          type="button"
                          onClick={() => onOpenDocument(docTarget)}
                          className="inline-flex items-center gap-1.5 rounded border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 font-mono text-[11px] font-medium text-sky-300 transition-colors hover:bg-sky-400/20"
                        >
                          <BookOpen aria-hidden className="size-3" />
                          Read {docTarget.docId}
                          {docTarget.page != null
                            ? ` (p.${docTarget.page})`
                            : ""}
                        </button>
                        {primaryUrl ? (
                          <a
                            href={primaryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted inline-flex items-center gap-1 font-mono text-[11px] transition-colors hover:text-sky-300"
                          >
                            NASA Source
                            <ExternalLink aria-hidden className="size-3" />
                          </a>
                        ) : null}
                      </div>
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
