"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  ExternalLink,
  FileText,
  FlaskConical,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DocumentReaderModal,
  type DocumentReaderTarget,
} from "@/features/copilot/components/document-reader";
import { useDocuments } from "@/features/copilot/hooks";
import { cn } from "@/lib/cn";
import {
  formatSourceLinkLabel,
  searchResources,
  SOURCE_TYPE_LABEL,
  tokenizeKeywords,
  type ResourceSearchResult,
  type SourceFilter,
} from "../lib/search-resources";

const SUGGESTED_KEYWORDS: readonly { label: string; query: string }[] = [
  { label: "BASS-II Ventilation Paradox", query: "BASS-II ventilation paradox" },
  { label: "SoFIE Artemis 34% O2", query: "SoFIE Artemis 34% O2" },
  { label: "FLEX Cool Flames", query: "FLEX cool flames droplet" },
  { label: "Apollo 1, Apollo 13 & Mir", query: "Apollo 1 Apollo 13 Mir" },
  { label: "NASA-STD-6001B Lunar", query: "NASA-STD-6001B Lunar partial gravity" },
  { label: "Firefighting Spinoffs", query: "spinoff SCBA detector turnout gear" },
  { label: "Saffire & ISS Facilities", query: "Saffire CIR MSG SPICE SLICE" },
  { label: "Smoke Detection (SAME / DAFT)", query: "SAME DAFT smoke detector aerosol" },
];

const SOURCE_FILTERS: readonly { id: SourceFilter; label: string }[] = [
  { id: "all", label: "All Resources" },
  { id: "ntrs", label: "NTRS & PSI Papers" },
  { id: "iss_page", label: "ISS Investigation Summaries" },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({
  text,
  terms,
}: {
  text: string;
  terms: readonly string[];
}): ReactNode {
  if (!terms.length || !text) return text;
  const sorted = [...terms]
    .filter((t) => t.length >= 2)
    .sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return text;

  const pattern = new RegExp(`(${sorted.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);
  const lowerSet = new Set(sorted.map((t) => t.toLowerCase()));

  return parts.map((part, idx) =>
    lowerSet.has(part.toLowerCase()) ? (
      <mark
        key={idx}
        className="rounded bg-amber-400/25 px-1 py-0.5 font-medium text-amber-200"
      >
        {part}
      </mark>
    ) : (
      <Fragment key={idx}>{part}</Fragment>
    ),
  );
}

export function ResourcesView() {
  const {
    data: documents,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useDocuments();
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [readerTarget, setReaderTarget] = useState<DocumentReaderTarget | null>(
    null,
  );

  const terms = useMemo(() => tokenizeKeywords(query), [query]);
  const results = useMemo(
    () => searchResources(documents ?? [], query, sourceFilter),
    [documents, query, sourceFilter],
  );

  const hasKeywords = terms.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <header className="space-y-1">
        <p className="text-muted font-mono text-[11px] tracking-wide">
          MODULE 05
        </p>
        <h1 className="text-xl font-semibold">Search Resources</h1>
        <p className="text-muted max-w-2xl text-sm">
          Type keywords below to search across NASA NTRS &amp; PSI combustion
          papers, ISS investigation summaries, historical spacecraft fire
          incident reports, and terrestrial firefighting spinoffs.
        </p>
      </header>

      {/* Searchbar & quick filters */}
      <Card>
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="resource-keyword-search"
              className="text-fg block text-xs font-medium"
            >
              Search by keywords
            </label>
            <div className="relative flex items-center">
              <Search
                aria-hidden
                className="text-muted pointer-events-none absolute left-3.5 size-4"
              />
              <input
                id="resource-keyword-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type keywords (e.g. Apollo 1, cool flames, BASS-II, spinoff, ventilation, 6001B, Nomex)…"
                aria-label="Search resources by keyword"
                className="border-border bg-bg text-fg placeholder:text-muted/70 focus:border-accent focus:ring-accent/30 w-full rounded-md border py-2.5 pr-10 pl-10 text-sm transition-colors focus:ring-2 focus:outline-none"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search keywords"
                  className="text-muted hover:text-fg absolute right-2.5 rounded p-1 transition-colors"
                >
                  <X aria-hidden className="size-4" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Suggested keyword pills */}
          <div className="space-y-1.5">
            <span className="text-muted inline-flex items-center gap-1 font-mono text-[11px] uppercase">
              <Sparkles aria-hidden className="text-accent size-3" />
              Popular keywords:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_KEYWORDS.map((item) => {
                const isSelected =
                  query.trim().toLowerCase() === item.query.toLowerCase();
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() =>
                      setQuery(isSelected ? "" : item.query)
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                      isSelected
                        ? "border-accent bg-accent/15 text-accent font-medium"
                        : "border-border bg-bg text-muted hover:border-accent/40 hover:text-fg",
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source type filter & status summary */}
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <div
              role="group"
              aria-label="Filter by resource type"
              className="flex flex-wrap items-center gap-1.5"
            >
              {SOURCE_FILTERS.map((f) => {
                const active = sourceFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSourceFilter(f.id)}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-mono text-xs transition-colors",
                      active
                        ? "bg-surface-2 text-fg border-accent/40 border font-medium"
                        : "text-muted hover:bg-surface-2/60 hover:text-fg",
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <p role="status" className="text-muted font-mono text-xs">
              {isPending
                ? "Loading resource catalog…"
                : hasKeywords
                  ? `${results.length} relevant ${results.length === 1 ? "resource" : "resources"} for “${query.trim()}”`
                  : `Showing all ${results.length} resources in catalog`}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Results list */}
      {isPending ? (
        <div className="space-y-4" aria-busy="true">
          {[1, 2, 3].map((n) => (
            <Card key={n}>
              <CardBody className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-16 w-full" />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Could not load resources"
          error={error}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : results.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title={`No resources matched “${query.trim()}”`}
            description="Try broader keywords such as BASS-II, SoFIE, FLEX, ACME, Apollo, Mir, cool flames, Nomex, or spinoff."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setSourceFilter("all");
                }}
              >
                Reset search
              </Button>
            }
          />
        </Card>
      ) : (
        <ul aria-label="Relevant resources" className="space-y-4">
          {results.map((result) => (
            <li key={result.doc.doc_id}>
              <ResourceResultCard
                result={result}
                searchTerms={terms}
                onOpenDocument={setReaderTarget}
              />
            </li>
          ))}
        </ul>
      )}

      <DocumentReaderModal
        key={
          readerTarget
            ? `${readerTarget.docId}-${readerTarget.page ?? "all"}`
            : "closed"
        }
        target={readerTarget}
        onClose={() => setReaderTarget(null)}
      />
    </div>
  );
}

function ResourceResultCard({
  result,
  searchTerms,
  onOpenDocument,
}: {
  result: ResourceSearchResult;
  searchTerms: readonly string[];
  onOpenDocument: (target: DocumentReaderTarget) => void;
}) {
  const { doc, matchedTerms, pageSnippets } = result;
  const sources = doc.sources?.length
    ? doc.sources
    : doc.url
      ? [doc.url]
      : [];
  const primaryUrl = sources[0];
  const firstMatchedPage = pageSnippets[0]?.page;

  return (
    <article className="rounded-card border-border bg-surface hover:border-sky-400/40 space-y-4 border p-5 transition-colors">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 font-mono text-xs font-medium text-sky-300">
              <FileText aria-hidden className="size-3.5" />
              <HighlightedText text={doc.doc_id} terms={searchTerms} />
            </span>
            {doc.investigation ? (
              <Badge tone="info">{doc.investigation}</Badge>
            ) : null}
            <Badge>
              {SOURCE_TYPE_LABEL[doc.source_type] ?? doc.source_type}
            </Badge>
            <span className="text-muted font-mono text-[11px]">
              {doc.page_count} {doc.page_count === 1 ? "page" : "pages"}
            </span>
            {searchTerms.length > 0 && matchedTerms.length > 0 ? (
              <Badge tone="success" dot>
                Matched {matchedTerms.length}/{searchTerms.length}{" "}
                {searchTerms.length === 1 ? "keyword" : "keywords"}
              </Badge>
            ) : null}
          </div>

          <h2 className="text-fg text-base leading-snug font-semibold">
            <button
              type="button"
              onClick={() =>
                onOpenDocument({
                  docId: doc.doc_id,
                  page: firstMatchedPage,
                })
              }
              className="text-left transition-colors hover:text-sky-300"
            >
              <HighlightedText text={doc.title} terms={searchTerms} />
            </button>
          </h2>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onOpenDocument({
                docId: doc.doc_id,
                page: firstMatchedPage,
              })
            }
            className="inline-flex items-center gap-1.5 rounded border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 font-mono text-xs font-medium text-sky-300 transition-colors hover:bg-sky-400/20"
          >
            <BookOpen aria-hidden className="size-3.5" />
            Read paper
          </button>
          {primaryUrl ? (
            <a
              href={primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border bg-bg text-muted hover:text-fg inline-flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-xs transition-colors hover:border-sky-400/40"
            >
              Official NASA Source
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          ) : null}
        </div>
      </div>

      {/* Matching page / section snippets */}
      {pageSnippets.length > 0 ? (
        <div className="space-y-2">
          {pageSnippets.map((snip, idx) => (
            <div
              key={`${snip.page}-${idx}`}
              className="border-border/80 bg-bg/70 rounded-md border p-3"
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="text-fg font-mono text-xs font-medium">
                  {snip.section ? (
                    <HighlightedText text={snip.section} terms={searchTerms} />
                  ) : (
                    `Page ${snip.page}`
                  )}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onOpenDocument({ docId: doc.doc_id, page: snip.page })
                  }
                  className="rounded border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 font-mono text-[11px] text-sky-300 transition-colors hover:bg-sky-400/25"
                >
                  Open Page {snip.page} →
                </button>
              </div>
              <p className="text-muted text-xs leading-relaxed">
                <HighlightedText text={snip.snippet} terms={searchTerms} />
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {/* External NASA resource links & related experiments footer */}
      {sources.length > 0 || (doc.related_experiment_ids?.length ?? 0) > 0 ? (
        <footer className="border-border/70 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          {sources.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted mr-1 font-mono text-[10px] uppercase">
                NASA Links:
              </span>
              {sources.map((src, idx) => (
                <a
                  key={idx}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border bg-bg text-muted hover:text-fg inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] transition-colors hover:border-sky-400/40"
                >
                  <HighlightedText
                    text={formatSourceLinkLabel(src)}
                    terms={searchTerms}
                  />
                  <ExternalLink aria-hidden className="size-2.5" />
                </a>
              ))}
            </div>
          ) : null}

          {doc.related_experiment_ids &&
          doc.related_experiment_ids.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted inline-flex items-center gap-1 font-mono text-[10px] uppercase">
                <FlaskConical aria-hidden className="text-accent size-3" />
                Runs:
              </span>
              {doc.related_experiment_ids.slice(0, 6).map((expId) => (
                <span
                  key={expId}
                  className="border-accent/30 bg-accent/10 text-accent rounded border px-1.5 py-0.5 font-mono text-[10px]"
                >
                  <HighlightedText text={expId} terms={searchTerms} />
                </span>
              ))}
              {doc.related_experiment_ids.length > 6 ? (
                <span className="text-muted font-mono text-[10px]">
                  +{doc.related_experiment_ids.length - 6} more
                </span>
              ) : null}
            </div>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}
