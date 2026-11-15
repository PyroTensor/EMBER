"use client";

import {
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
} from "lucide-react";
import type { AskResponse, DocumentSummary } from "@/lib/api/types";
import { parseDocTag, tokenize } from "../lib/citations";
import {
  findRelevantPsiPublications,
  formatDocDisplayName,
  getDocumentDownloadUrl,
  isCsvOrTableDoc,
} from "../lib/psi-publications";
import type { DocumentReaderTarget } from "./document-reader";

interface RelevantPapersProps {
  response: AskResponse;
  question?: string;
  documentsById: ReadonlyMap<string, DocumentSummary>;
  onOpenDocument: (target: DocumentReaderTarget) => void;
}

interface ReferencedDoc {
  docId: string;
  citedPages: number[];
  citedByAnswer: boolean;
}

function collectReferencedDocs(
  response: AskResponse,
  documentsById: ReadonlyMap<string, DocumentSummary>,
): ReferencedDoc[] {
  const byDoc = new Map<
    string,
    { canonicalId: string; pages: Set<number>; citedByAnswer: boolean }
  >();

  const add = (
    docId: string | null | undefined,
    page: number | null | undefined,
    fromAnswer: boolean,
  ) => {
    if (!docId || isCsvOrTableDoc(docId)) return;
    const key = docId.toUpperCase();
    const meta = documentsById.get(docId) ?? documentsById.get(key);
    const canonicalId = meta?.doc_id ?? docId;
    let entry = byDoc.get(key);
    if (!entry) {
      entry = { canonicalId, pages: new Set<number>(), citedByAnswer: false };
      byDoc.set(key, entry);
    }
    if (page != null && Number.isFinite(page)) entry.pages.add(page);
    if (fromAnswer) entry.citedByAnswer = true;
  };

  // 1. Inline answer tags (e.g. [BASS-II_SRD p.9])
  for (const tok of tokenize(response.answer ?? "")) {
    if (tok.type === "cite") {
      const parsed = parseDocTag(tok.value);
      if (parsed) add(parsed.docId, parsed.page, true);
    }
  }

  // 2. Response document citations (never CSV experiment run tables)
  for (const c of response.citations ?? []) {
    if (c.kind === "doc" && c.doc_id) add(c.doc_id, c.page, true);
  }

  // 3. Fallback to retrieved PDF/document chunk evidence if answer didn't tag a doc directly
  if (byDoc.size === 0) {
    for (const ev of response.evidence ?? []) {
      if (ev.kind === "chunk" && ev.doc_id) add(ev.doc_id, ev.page, false);
    }
  }

  return [...byDoc.values()]
    .sort((ea, eb) => {
      if (ea.citedByAnswer !== eb.citedByAnswer)
        return ea.citedByAnswer ? -1 : 1;
      return ea.canonicalId.localeCompare(eb.canonicalId);
    })
    .map(({ canonicalId, pages, citedByAnswer }) => ({
      docId: canonicalId,
      citedPages: [...pages].sort((a, b) => a - b),
      citedByAnswer,
    }));
}

/** Shows the NASA PDFs/documents referenced by an answer for direct download plus peer-reviewed DOI publications. */
export function RelevantPapers({
  response,
  question,
  documentsById,
  onOpenDocument,
}: RelevantPapersProps) {
  if (response.supported === false) return null;
  const refs = collectReferencedDocs(response, documentsById);
  const publications = findRelevantPsiPublications({
    docIds: refs.map((r) => r.docId),
    documentsById,
    question,
    answer: response.answer ?? "",
    limit: 6,
  });

  if (refs.length === 0 && publications.length === 0) return null;

  return (
    <section
      aria-label="Relevant NASA papers and publications"
      className="rounded-card border-border bg-surface space-y-5 border p-5"
    >
      {refs.length > 0 ? (
        <div className="space-y-3">
          <header className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-fg flex items-center gap-1.5 text-sm font-semibold">
                <BookOpen aria-hidden className="size-4 text-sky-400" />
                Relevant NASA PDFs &amp; documents ({refs.length})
              </h4>
              <p className="text-muted text-xs">
                Download the original NASA report or PDF directly, preview
                extracted text, or open the official NTRS / PSI record.
              </p>
            </div>
          </header>

          <ul className="grid gap-3 md:grid-cols-2">
            {refs.map(({ docId, citedPages, citedByAnswer }) => {
              const meta =
                documentsById.get(docId) ??
                documentsById.get(docId.toUpperCase());
              const canonicalId = meta?.doc_id ?? docId;
              const displayTitle = formatDocDisplayName(canonicalId, meta);
              const firstPage = citedPages[0];
              const allSources =
                meta?.sources ?? (meta?.url ? [meta.url] : []);
              const primaryUrl = allSources.find((s) => s.startsWith("http"));
              const downloadUrl = getDocumentDownloadUrl(canonicalId);

              return (
                <li
                  key={canonicalId}
                  className="group border-border bg-bg flex flex-col justify-between rounded-md border p-3.5 transition-colors hover:border-sky-400/50"
                >
                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded border border-sky-400/40 bg-sky-400/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-sky-300">
                          <FileText aria-hidden className="size-3" />
                          {canonicalId}
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
                            {meta.page_count}{" "}
                            {meta.page_count === 1 ? "page" : "pages"}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-fg mt-1.5 text-sm font-medium">
                        {displayTitle}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <a
                        href={downloadUrl}
                        download
                        title="Download original PDF or document file"
                        className="inline-flex items-center gap-1.5 rounded border border-emerald-400/40 bg-emerald-400/15 px-2.5 py-1 font-mono text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-400/25"
                      >
                        <Download aria-hidden className="size-3.5" />
                        Download PDF
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenDocument({ docId: canonicalId, page: firstPage })
                        }
                        className="inline-flex items-center gap-1.5 rounded border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 font-mono text-xs font-medium text-sky-300 transition-colors hover:bg-sky-400/20"
                      >
                        <BookOpen aria-hidden className="size-3.5" />
                        Preview text
                      </button>
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
                        Cited pages:
                      </span>
                      {citedPages.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() =>
                            onOpenDocument({ docId: canonicalId, page: p })
                          }
                          className="rounded border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 font-mono text-[11px] text-sky-300 transition-colors hover:bg-sky-400/25"
                        >
                          p.{p}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {publications.length > 0 ? (
        <div
          className={
            refs.length > 0 ? "border-border/70 space-y-3 border-t pt-4" : "space-y-3"
          }
        >
          <header>
            <h4 className="text-fg flex items-center gap-1.5 text-sm font-semibold">
              <GraduationCap aria-hidden className="size-4 text-amber-400" />
              Related NASA PSI Peer-Reviewed Publications (
              {publications.length})
            </h4>
            <p className="text-muted text-xs">
              External journal papers and DOI links associated with these PSI
              combustion investigations.
            </p>
          </header>

          <ul className="grid gap-2.5 md:grid-cols-2">
            {publications.map((pub) => (
              <li
                key={pub.url}
                className="border-border bg-bg/70 flex flex-col justify-between gap-2 rounded-md border p-3 transition-colors hover:border-amber-400/40"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1">
                    {pub.psiCodes.map((code) => (
                      <span
                        key={code}
                        className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-300"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                  <a
                    href={pub.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-fg block text-xs leading-snug font-medium transition-colors hover:text-amber-300"
                  >
                    {pub.title}
                  </a>
                  {pub.authors ? (
                    <p className="text-muted text-[11px]">{pub.authors}</p>
                  ) : null}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <a
                    href={pub.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-300 hover:underline"
                  >
                    {pub.url.includes("ntrs.nasa.gov")
                      ? "Open NTRS Record"
                      : "Open DOI Publication"}
                    <ExternalLink aria-hidden className="size-3" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
