"use client";

import { BookOpen, Download, ExternalLink, FileText } from "lucide-react";
import type { AskResponse, DocumentSummary } from "@/lib/api/types";
import { parseDocTag, tokenize } from "../lib/citations";
import type { DocumentReaderTarget } from "./document-reader";

interface RelevantPapersProps {
  response: AskResponse;
  documentsById: ReadonlyMap<string, DocumentSummary>;
  onOpenDocument: (target: DocumentReaderTarget) => void;
}

interface ReferencedDoc {
  docId: string;
  citedPages: number[];
  citedByAnswer: boolean;
}

function collectReferencedDocs(response: AskResponse): ReferencedDoc[] {
  const byDoc = new Map<
    string,
    { pages: Set<number>; citedByAnswer: boolean }
  >();

  const add = (
    docId: string | null | undefined,
    page: number | null | undefined,
    fromAnswer: boolean,
  ) => {
    if (!docId) return;
    const key = docId.toUpperCase();
    let entry = byDoc.get(key);
    if (!entry) {
      entry = { pages: new Set<number>(), citedByAnswer: false };
      byDoc.set(key, entry);
    }
    if (page != null && Number.isFinite(page)) entry.pages.add(page);
    if (fromAnswer) entry.citedByAnswer = true;
  };

  // 1. Inline answer tags (e.g. [DOC-03 p.2])
  for (const tok of tokenize(response.answer ?? "")) {
    if (tok.type === "cite") {
      const parsed = parseDocTag(tok.value);
      if (parsed) add(parsed.docId, parsed.page, true);
    }
  }

  // 2. Response citations array (both direct doc citations and experiment source docs)
  for (const c of response.citations ?? []) {
    if (c.doc_id) add(c.doc_id, c.page, true);
  }

  // 3. Fallback to top chunk evidence only if no direct citations had doc_ids
  if (byDoc.size === 0) {
    for (const ev of response.evidence ?? []) {
      if (ev.doc_id) add(ev.doc_id, ev.page, false);
    }
  }

  return [...byDoc.entries()]
    .sort(([a, ea], [b, eb]) => {
      if (ea.citedByAnswer !== eb.citedByAnswer)
        return ea.citedByAnswer ? -1 : 1;
      return a.localeCompare(b);
    })
    .map(([docId, { pages, citedByAnswer }]) => ({
      docId,
      citedPages: [...pages].sort((a, b) => a - b),
      citedByAnswer,
    }));
}

/** Shows the papers/documents referenced by an answer so researchers can click to read them or open official NASA PDFs. */
export function RelevantPapers({
  response,
  documentsById,
  onOpenDocument,
}: RelevantPapersProps) {
  if (response.supported === false) return null;
  const refs = collectReferencedDocs(response);
  if (refs.length === 0) return null;

  return (
    <section
      aria-label="Relevant papers and documents"
      className="rounded-card border-border bg-surface space-y-3 border p-5"
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-fg flex items-center gap-1.5 text-sm font-semibold">
            <BookOpen aria-hidden className="size-4 text-sky-400" />
            Relevant papers &amp; documents ({refs.length})
          </h4>
          <p className="text-muted text-xs">
            Click any paper or cited page below to read the document in full or
            open its official NASA PDF.
          </p>
        </div>
      </header>

      <ul className="grid gap-3 md:grid-cols-2">
        {refs.map(({ docId, citedPages, citedByAnswer }) => {
          const meta = documentsById.get(docId);
          const firstPage = citedPages[0];
          const allSources = meta?.sources ?? (meta?.url ? [meta.url] : []);
          const localPdf = allSources.find((s) => s.startsWith("/papers/"));
          const primaryUrl = allSources.find((s) => s.startsWith("http"));

          return (
            <li
              key={docId}
              className="group border-border bg-bg flex flex-col justify-between rounded-md border p-3.5 transition-colors hover:border-sky-400/50"
            >
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => onOpenDocument({ docId, page: firstPage })}
                  className="w-full text-left"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded border border-sky-400/40 bg-sky-400/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-sky-300">
                      <FileText aria-hidden className="size-3" />
                      {docId}
                    </span>
                    {meta?.investigation ? (
                      <span className="border-border bg-surface text-muted rounded border px-1.5 py-0.5 font-mono text-[10px]">
                        {meta.investigation}
                      </span>
                    ) : null}
                    {citedByAnswer ? (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                        Cited in answer
                      </span>
                    ) : null}
                    {meta?.page_count ? (
                      <span className="text-muted font-mono text-[10px]">
                        {meta.page_count} pages
                      </span>
                    ) : null}
                  </div>
                  <p className="text-fg mt-1.5 text-sm font-medium transition-colors group-hover:text-sky-300">
                    {meta?.title ?? `Document ${docId}`}
                  </p>
                </button>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenDocument({ docId, page: firstPage })}
                    className="inline-flex items-center gap-1.5 rounded border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 font-mono text-xs font-medium text-sky-300 transition-colors hover:bg-sky-400/20"
                  >
                    <BookOpen aria-hidden className="size-3.5" />
                    Read paper
                  </button>
                  {localPdf ? (
                    <a
                      href={localPdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open downloaded NASA PDF"
                      className="inline-flex items-center gap-1 rounded border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-mono text-xs text-emerald-300 transition-colors hover:bg-emerald-400/20"
                    >
                      NASA PDF
                      <Download aria-hidden className="size-3" />
                    </a>
                  ) : null}
                  {primaryUrl ? (
                    <a
                      href={primaryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open official NASA resource in new tab"
                      className="border-border bg-surface text-muted hover:text-fg inline-flex items-center gap-1 rounded border px-2.5 py-1 font-mono text-xs transition-colors hover:border-sky-400/40"
                    >
                      NASA Source
                      <ExternalLink aria-hidden className="size-3" />
                    </a>
                  ) : null}
                </div>
              </div>

              {citedPages.length > 0 ? (
                <div className="border-border/70 mt-2.5 flex flex-wrap items-center gap-1.5 border-t pt-2">
                  <span className="text-muted font-mono text-[10px] uppercase">
                    Jump to cited page:
                  </span>
                  {citedPages.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onOpenDocument({ docId, page: p })}
                      className="rounded border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 font-mono text-[11px] text-sky-300 transition-colors hover:bg-sky-400/25"
                    >
                      Page {p} →
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
