"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  ExternalLink,
  FileText,
  FlaskConical,
  Layers,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { useDocument } from "../hooks";

export interface DocumentReaderTarget {
  docId: string;
  page?: number;
}

interface DocumentReaderModalProps {
  target: DocumentReaderTarget | null;
  onClose: () => void;
}

const SOURCE_TYPE_LABEL: Record<string, string> = {
  ntrs: "NASA NTRS / PSI Paper",
  iss_page: "ISS Investigation Summary",
  psi_dataset: "NASA PSI Dataset",
};

function formatSourceLinkLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/$/, "");
    if (host.includes("psi.nasa.gov")) {
      const q = parsed.searchParams.get("q");
      return q ? `NASA PSI Repository (${q})` : "NASA PSI Repository";
    }
    if (host.includes("spinoff.nasa.gov")) {
      return `NASA Spinoff (${path.split("/").pop() ?? "Article"})`;
    }
    if (host.includes("sma.nasa.gov")) {
      return `NASA SMA (${path.split("/").pop()?.toUpperCase() ?? "Report"})`;
    }
    if (host.includes("youtube.com")) {
      return "NASA ScienceCasts Video";
    }
    const lastSeg = path.split("/").filter(Boolean).pop();
    return lastSeg ? `${host} · ${lastSeg}` : host;
  } catch {
    return url;
  }
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="text-fg font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function renderSectionBody(text: string): ReactNode {
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim());
  return (
    <div className="text-fg/90 space-y-3 text-sm leading-relaxed">
      {blocks.map((block, bi) => {
        const lines = block
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        // Markdown table block
        if (
          lines.length >= 2 &&
          lines.every((l) => l.startsWith("|") && l.endsWith("|"))
        ) {
          const parseRow = (r: string) =>
            r
              .slice(1, -1)
              .split("|")
              .map((c) => c.trim());
          const header = parseRow(lines[0]!);
          const bodyRows = lines.slice(2).map(parseRow);
          return (
            <div
              key={bi}
              className="border-border overflow-x-auto rounded-md border"
            >
              <table className="w-full text-left text-xs">
                <thead className="border-border bg-surface-2 text-muted border-b font-mono text-[11px] uppercase">
                  <tr>
                    {header.map((h, hi) => (
                      <th key={hi} className="px-3 py-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {bodyRows.map((row, ri) => (
                    <tr key={ri} className="bg-bg/60">
                      {row.map((cell, ci) => (
                        <td key={ci} className="text-fg/90 px-3 py-2">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Blockquote note
        if (lines.every((l) => l.startsWith(">"))) {
          const quoteText = lines.map((l) => l.replace(/^>\s?/, "")).join(" ");
          return (
            <blockquote
              key={bi}
              className="text-muted rounded-md border-l-2 border-sky-400/50 bg-sky-400/5 px-3.5 py-2.5 text-xs leading-relaxed italic"
            >
              {renderInline(quoteText)}
            </blockquote>
          );
        }

        // Bullet or numbered list
        if (lines.every((l) => /^(-|\*|\d+\.)\s+/.test(l))) {
          return (
            <ul
              key={bi}
              className="text-fg/90 list-disc space-y-1.5 pl-5 text-sm"
            >
              {lines.map((l, li) => (
                <li key={li}>
                  {renderInline(l.replace(/^(-|\*|\d+\.)\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        }

        return <p key={bi}>{renderInline(lines.join(" "))}</p>;
      })}
    </div>
  );
}

/** Modal reader that displays the full multi-page text, metadata, and external NASA links for a corpus document. */
export function DocumentReaderModal({
  target,
  onClose,
}: DocumentReaderModalProps) {
  const docId = target?.docId ?? null;
  const citedPage = target?.page;
  const {
    data: doc,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useDocument(docId);
  const [selectedPage, setSelectedPage] = useState<number | "all">("all");
  const pageRefs = useRef<Record<number, HTMLElement | null>>({});

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  useEffect(() => {
    if (!doc || !citedPage) return;
    const el = pageRefs.current[citedPage];
    if (el) {
      const id = window.setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return () => window.clearTimeout(id);
    }
  }, [doc, citedPage]);

  if (!target) return null;

  const pages = doc?.pages ?? [];
  const visiblePages =
    selectedPage === "all"
      ? pages
      : pages.filter((p) => p.page === selectedPage);
  const sources = doc?.sources ?? (doc?.url ? [doc.url] : []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Document reader: ${target.docId}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-xs sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="rounded-card border-border bg-surface flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden border shadow-2xl">
        {/* Top bar */}
        <header className="border-border bg-surface-2/60 flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 font-mono text-xs font-medium text-sky-300">
                <FileText aria-hidden className="size-3.5" />
                {target.docId}
              </span>
              {doc?.investigation ? (
                <Badge tone="info">{doc.investigation}</Badge>
              ) : null}
              {doc?.source_type ? (
                <Badge>
                  {SOURCE_TYPE_LABEL[doc.source_type] ?? doc.source_type}
                </Badge>
              ) : null}
              {citedPage != null ? (
                <Badge tone="success" dot>
                  Cited p.{citedPage}
                </Badge>
              ) : null}
            </div>
            <h2 className="text-fg text-base leading-snug font-semibold">
              {doc?.title ?? `Loading ${target.docId}…`}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close document reader"
            className="border-border bg-surface text-muted hover:bg-surface-2 hover:text-fg shrink-0 rounded-md border p-1.5 transition-colors"
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>

        {/* External NASA Source links + Page selector */}
        {doc ? (
          <div className="border-border bg-bg/60 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted mr-1 inline-flex items-center gap-1 font-mono text-[11px] uppercase">
                <Layers aria-hidden className="size-3.5" />
                Pages:
              </span>
              <button
                type="button"
                onClick={() => setSelectedPage("all")}
                className={cn(
                  "rounded px-2 py-0.5 font-mono text-xs transition-colors",
                  selectedPage === "all"
                    ? "bg-accent text-bg font-medium"
                    : "border-border bg-surface text-muted hover:text-fg border",
                )}
              >
                All ({doc.page_count})
              </button>
              {pages.map((p) => {
                const isCited = citedPage === p.page;
                const isActive = selectedPage === p.page;
                return (
                  <button
                    key={p.page}
                    type="button"
                    onClick={() => setSelectedPage(p.page)}
                    className={cn(
                      "rounded px-2 py-0.5 font-mono text-xs transition-colors",
                      isActive
                        ? "bg-accent text-bg font-medium"
                        : isCited
                          ? "border border-sky-400/50 bg-sky-400/15 text-sky-300 hover:bg-sky-400/25"
                          : "border-border bg-surface text-muted hover:text-fg border",
                    )}
                  >
                    p.{p.page}
                    {isCited ? " ★" : ""}
                  </button>
                );
              })}
            </div>

            {sources.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 font-mono text-[11px] text-sky-300 transition-colors hover:bg-sky-400/20"
                  >
                    {formatSourceLinkLabel(src)}
                    <ExternalLink aria-hidden className="size-3" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {isPending ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : isError ? (
            <ErrorState
              title={`Could not load document ${target.docId}`}
              error={error}
              onRetry={() => refetch()}
              retrying={isFetching}
            />
          ) : doc ? (
            <>
              {visiblePages.map((p) => {
                const isCitedPage = citedPage === p.page;
                return (
                  <section
                    key={p.page}
                    ref={(el) => {
                      pageRefs.current[p.page] = el;
                    }}
                    className={cn(
                      "rounded-card space-y-4 border p-5 transition-colors",
                      isCitedPage
                        ? "border-sky-400/50 bg-sky-400/[0.04]"
                        : "border-border bg-bg/70",
                    )}
                  >
                    <div className="border-border flex items-center justify-between border-b pb-2.5">
                      <span className="text-fg inline-flex items-center gap-1.5 font-mono text-xs font-semibold">
                        <BookOpen
                          aria-hidden
                          className="size-3.5 text-sky-400"
                        />
                        {doc.doc_id} · Page {p.page} of {doc.page_count}
                      </span>
                      {isCitedPage ? (
                        <span className="rounded bg-sky-400/15 px-2 py-0.5 font-mono text-[11px] text-sky-300">
                          Referenced in answer / evidence
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-4">
                      {(p.sections ?? []).map((sec, si) => (
                        <div key={si} className="space-y-2">
                          {sec.section && sec.section !== doc.title ? (
                            <h3 className="text-fg text-sm font-semibold">
                              {sec.section}
                            </h3>
                          ) : null}
                          {renderSectionBody(sec.text)}
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}

              {doc.related_experiment_ids &&
              doc.related_experiment_ids.length > 0 ? (
                <footer className="border-border bg-bg/50 rounded-md border p-4">
                  <div className="text-muted flex items-center gap-1.5 font-mono text-[11px] uppercase">
                    <FlaskConical
                      aria-hidden
                      className="text-accent size-3.5"
                    />
                    Associated Test Runs in EMBER Dataset (
                    {doc.related_experiment_ids.length})
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {doc.related_experiment_ids.map((expId) => (
                      <span
                        key={expId}
                        className="border-accent/30 bg-accent/10 text-accent rounded border px-2 py-0.5 font-mono text-[11px]"
                      >
                        {expId}
                      </span>
                    ))}
                  </div>
                </footer>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
