"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, Download, ExternalLink, FileDown, FileText, FlaskConical, Layers, X } from "lucide-react";
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

const LOCAL_PDF_LABELS: Record<string, string> = {
  "/papers/iss_researchers_guide_combustion_science.pdf": "ISS Researcher's Guide (PDF)",
  "/papers/nasa_glenn_acme.pdf": "NASA Glenn ACME Dossier (PDF)",
  "/papers/nasa_glenn_bass.pdf": "NASA Glenn BASS / BASS-II (PDF)",
  "/papers/nasa_glenn_daft.pdf": "NASA Glenn DAFT (PDF)",
  "/papers/nasa_glenn_flex.pdf": "NASA Glenn FLEX / FLEX-2 (PDF)",
  "/papers/nasa_glenn_saffire.pdf": "NASA Glenn Saffire I–VI (PDF)",
  "/papers/nasa_glenn_same.pdf": "NASA Glenn SAME / SAME-R (PDF)",
  "/papers/nasa_glenn_slice.pdf": "NASA Glenn SLICE (PDF)",
  "/papers/nasa_glenn_spice.pdf": "NASA Glenn SPICE (PDF)",
};

function formatSourceLinkLabel(url: string): string {
  if (url.startsWith("/papers/")) {
    return LOCAL_PDF_LABELS[url] ?? url.split("/").pop() ?? "Downloaded NASA PDF";
  }
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
    if (host.includes("hdl.handle.net")) {
      return `NTRS Handle (${path.split("/").pop() ?? "Report"})`;
    }
    if (host.includes("sma.nasa.gov")) {
      return `NASA SMA (${path.split("/").pop()?.toUpperCase() ?? "Report"})`;
    }
    if (host.includes("history.nasa.gov")) {
      return `NASA History (${path.split("/").pop() ?? "PDF"})`;
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
      <strong key={i} className="font-semibold text-fg">
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
    <div className="space-y-3 text-sm leading-relaxed text-fg/90">
      {blocks.map((block, bi) => {
        const lines = block
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        // Markdown table block
        if (lines.length >= 2 && lines.every((l) => l.startsWith("|") && l.endsWith("|"))) {
          const parseRow = (r: string) =>
            r
              .slice(1, -1)
              .split("|")
              .map((c) => c.trim());
          const header = parseRow(lines[0]!);
          const bodyRows = lines.slice(2).map(parseRow);
          return (
            <div key={bi} className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-2 font-mono text-[11px] text-muted uppercase">
                  <tr>
                    {header.map((h, hi) => (
                      <th key={hi} className="px-3 py-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bodyRows.map((row, ri) => (
                    <tr key={ri} className="bg-bg/60">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 text-fg/90">
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
              className="rounded-md border-l-2 border-sky-400/50 bg-sky-400/5 px-3.5 py-2.5 text-xs leading-relaxed text-muted italic"
            >
              {renderInline(quoteText)}
            </blockquote>
          );
        }

        // Bullet or numbered list
        if (lines.every((l) => /^(-|\*|\d+\.)\s+/.test(l))) {
          return (
            <ul key={bi} className="list-disc space-y-1.5 pl-5 text-sm text-fg/90">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^(-|\*|\d+\.)\s+/, ""))}</li>
              ))}
            </ul>
          );
        }

        return <p key={bi}>{renderInline(lines.join(" "))}</p>;
      })}
    </div>
  );
}

/** Modal reader that displays the full multi-page text, embedded NASA PDFs, and external NASA links for a corpus document. */
export function DocumentReaderModal({ target, onClose }: DocumentReaderModalProps) {
  const docId = target?.docId ?? null;
  const citedPage = target?.page;
  const { data: doc, isPending, isError, error, refetch, isFetching } = useDocument(docId);
  const [selectedPage, setSelectedPage] = useState<number | "all">("all");
  const [activePdf, setActivePdf] = useState<string | null>(null);
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
    if (!doc || !citedPage || activePdf) return;
    const el = pageRefs.current[citedPage];
    if (el) {
      const id = window.setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return () => window.clearTimeout(id);
    }
  }, [doc, citedPage, activePdf]);

  if (!target) return null;

  const pages = doc?.pages ?? [];
  const visiblePages = selectedPage === "all" ? pages : pages.filter((p) => p.page === selectedPage);
  const sources = doc?.sources ?? (doc?.url ? [doc.url] : []);
  const localPdfs = sources.filter((s) => s.startsWith("/papers/"));
  const externalSources = sources.filter((s) => !s.startsWith("/papers/"));

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
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-card border border-border bg-surface shadow-2xl">
        {/* Top bar */}
        <header className="flex items-start justify-between gap-4 border-b border-border bg-surface-2/60 px-5 py-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 font-mono text-xs font-medium text-sky-300">
                <FileText aria-hidden className="size-3.5" />
                {target.docId}
              </span>
              {doc?.investigation ? <Badge tone="info">{doc.investigation}</Badge> : null}
              {doc?.source_type ? (
                <Badge>{SOURCE_TYPE_LABEL[doc.source_type] ?? doc.source_type}</Badge>
              ) : null}
              {citedPage != null ? (
                <Badge tone="success" dot>
                  Cited p.{citedPage}
                </Badge>
              ) : null}
            </div>
            <h2 className="text-base font-semibold leading-snug text-fg">
              {doc?.title ?? `Loading ${target.docId}…`}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close document reader"
            className="shrink-0 rounded-md border border-border bg-surface p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>

        {/* Page selector + Downloaded NASA PDFs + External NASA Source links */}
        {doc ? (
          <div className="space-y-2 border-b border-border bg-bg/60 px-5 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 inline-flex items-center gap-1 font-mono text-[11px] text-muted uppercase">
                  <Layers aria-hidden className="size-3.5" />
                  View:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActivePdf(null);
                    setSelectedPage("all");
                  }}
                  className={cn(
                    "rounded px-2 py-0.5 font-mono text-xs transition-colors",
                    !activePdf && selectedPage === "all"
                      ? "bg-accent text-bg font-medium"
                      : "border border-border bg-surface text-muted hover:text-fg",
                  )}
                >
                  All Pages ({doc.page_count})
                </button>
                {pages.map((p) => {
                  const isCited = citedPage === p.page;
                  const isActive = !activePdf && selectedPage === p.page;
                  return (
                    <button
                      key={p.page}
                      type="button"
                      onClick={() => {
                        setActivePdf(null);
                        setSelectedPage(p.page);
                      }}
                      className={cn(
                        "rounded px-2 py-0.5 font-mono text-xs transition-colors",
                        isActive
                          ? "bg-accent text-bg font-medium"
                          : isCited
                            ? "border border-sky-400/50 bg-sky-400/15 text-sky-300 hover:bg-sky-400/25"
                            : "border border-border bg-surface text-muted hover:text-fg",
                      )}
                    >
                      p.{p.page}
                      {isCited ? " ★" : ""}
                    </button>
                  );
                })}
              </div>

              {externalSources.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {externalSources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 font-mono text-[11px] text-sky-300 transition-colors hover:bg-sky-400/20"
                    >
                      {formatSourceLinkLabel(src)}
                      <ExternalLink aria-hidden className="size-3" />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            {localPdfs.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
                <span className="mr-1 inline-flex items-center gap-1 font-mono text-[11px] text-muted uppercase">
                  <FileDown aria-hidden className="size-3.5 text-emerald-400" />
                  Downloaded NASA PDFs:
                </span>
                {localPdfs.map((pdfUrl) => {
                  const isViewing = activePdf === pdfUrl;
                  return (
                    <span key={pdfUrl} className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setActivePdf(isViewing ? null : pdfUrl)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                          isViewing
                            ? "border-emerald-400 bg-emerald-400/20 font-medium text-emerald-200"
                            : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20",
                        )}
                      >
                        <BookOpen aria-hidden className="size-3" />
                        {formatSourceLinkLabel(pdfUrl)}
                      </button>
                      <a
                        href={pdfUrl}
                        download
                        title={`Download ${formatSourceLinkLabel(pdfUrl)}`}
                        className="inline-flex items-center rounded border border-border bg-surface p-1 text-muted transition-colors hover:text-fg"
                      >
                        <Download aria-hidden className="size-3" />
                      </a>
                    </span>
                  );
                })}
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
          ) : activePdf ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-emerald-300">
                  Viewing downloaded NASA PDF: {formatSourceLinkLabel(activePdf)}
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={activePdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2.5 py-1 font-mono text-xs text-fg hover:bg-surface-2"
                  >
                    Open in new tab
                    <ExternalLink aria-hidden className="size-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setActivePdf(null)}
                    className="rounded border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 font-mono text-xs text-sky-300 hover:bg-sky-400/20"
                  >
                    Back to indexed pages
                  </button>
                </div>
              </div>
              <iframe
                src={activePdf}
                title={formatSourceLinkLabel(activePdf)}
                className="h-[68vh] w-full rounded-md border border-border bg-white"
              />
            </div>
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
                      "space-y-4 rounded-card border p-5 transition-colors",
                      isCitedPage
                        ? "border-sky-400/50 bg-sky-400/[0.04]"
                        : "border-border bg-bg/70",
                    )}
                  >
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-fg">
                        <BookOpen aria-hidden className="size-3.5 text-sky-400" />
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
                            <h3 className="text-sm font-semibold text-fg">{sec.section}</h3>
                          ) : null}
                          {renderSectionBody(sec.text)}
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}

              {doc.related_experiment_ids && doc.related_experiment_ids.length > 0 ? (
                <footer className="rounded-md border border-border bg-bg/50 p-4">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted uppercase">
                    <FlaskConical aria-hidden className="size-3.5 text-accent" />
                    Associated Test Runs in EMBER Dataset ({doc.related_experiment_ids.length})
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {doc.related_experiment_ids.map((expId) => (
                      <span
                        key={expId}
                        className="rounded border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[11px] text-accent"
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
