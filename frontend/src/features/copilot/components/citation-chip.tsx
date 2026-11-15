"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BookOpen, Download, FileText, FlaskConical, X } from "lucide-react";
import type { Citation, DocumentSummary } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { parseDocTag, tagLabel } from "../lib/citations";
import {
  formatDocDisplayName,
  getDocumentDownloadUrl,
  isCsvOrTableDoc,
} from "../lib/psi-publications";
import type { DocumentReaderTarget } from "./document-reader";

interface CitationChipProps {
  /** The tag as it appears in the answer, e.g. "[DOC-01 p.1]". */
  tag: string;
  /** The matching entry from AskResponse.citations, if any. */
  citation: Citation | undefined;
  /** Optional lookup of corpus documents for displaying the paper title. */
  documentsById?: ReadonlyMap<string, DocumentSummary>;
  /** Callback to open the full Document Reader modal at a specific document and page. */
  onOpenDocument?: (target: DocumentReaderTarget) => void;
}

const POPOVER_MAX_W = 340;
const EDGE = 8;

/** Inline citation button; click opens a popover with the source, snippet, and a button to read the full paper. */
export function CitationChip({
  tag,
  citation,
  documentsById,
  onOpenDocument,
}: CitationChipProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ left: 0, width: POPOVER_MAX_W });
  const popoverId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const parsedDoc = parseDocTag(tag);
  const rawDocId = citation?.doc_id ?? parsedDoc?.docId;
  const resolvedPage = citation?.page ?? parsedDoc?.page ?? undefined;
  const docMeta = rawDocId
    ? (documentsById?.get(rawDocId) ?? documentsById?.get(rawDocId.toUpperCase()))
    : undefined;
  const resolvedDocId = docMeta?.doc_id ?? rawDocId;

  const isDoc = citation?.kind === "doc" || Boolean(parsedDoc);
  const Icon = isDoc ? FileText : FlaskConical;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const toggle = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      // Fit the popover inside the viewport with an 8 px margin, shifting it left from the chip if needed.
      const vw = document.documentElement.clientWidth;
      const width = Math.min(POPOVER_MAX_W, vw - 2 * EDGE);
      const offset = Math.max(
        EDGE - rect.left,
        Math.min(0, vw - EDGE - width - rect.left),
      );
      setPlacement({ left: offset, width });
    }
    setOpen((o) => !o);
  };

  return (
    <span ref={wrapperRef} className="relative inline-block align-baseline">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label={`Source ${tagLabel(tag)}${citation ? "" : " (no details)"}`}
        className={cn(
          "mx-0.5 inline-flex items-center gap-1 rounded border px-1.5 py-px align-baseline font-mono text-[11px] leading-4 transition-colors",
          isDoc
            ? "border-sky-400/40 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20"
            : "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20",
          open && "ring-1 ring-current",
          !citation && !resolvedDocId && "border-dashed opacity-80",
        )}
      >
        <Icon aria-hidden className="size-3" />
        {tagLabel(tag)}
      </button>

      {open ? (
        <span
          id={popoverId}
          role="dialog"
          aria-label={`Citation ${tagLabel(tag)}`}
          style={{ left: placement.left, width: placement.width }}
          className="border-border bg-surface absolute top-full z-20 mt-1.5 block rounded-md border p-3 text-left font-sans text-xs shadow-xl"
        >
          <span className="flex items-start justify-between gap-2">
            <span className="block min-w-0">
              <span className="text-muted block text-[10px] font-medium tracking-wide uppercase">
                {isDoc ? "Document" : "Experiment"}
              </span>
              <span className="text-fg block font-mono text-sm">
                {citation
                  ? isDoc
                    ? `${citation.doc_id ?? tagLabel(tag)}${citation.page != null ? ` · page ${citation.page}` : ""}`
                    : (citation.experiment_id ?? tagLabel(tag))
                  : tagLabel(tag)}
              </span>
              {resolvedDocId ? (
                <span className="mt-0.5 block text-xs leading-snug font-medium text-sky-300">
                  {formatDocDisplayName(resolvedDocId, docMeta)}
                </span>
              ) : null}
              {citation && !isDoc && citation.doc_id ? (
                <span className="text-muted block text-[11px]">
                  Source: {citation.doc_id}
                  {citation.page != null ? ` p.${citation.page}` : ""}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
              aria-label="Close citation"
              className="text-muted hover:bg-surface-2 hover:text-fg rounded p-0.5"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </span>
          {citation?.snippet ? (
            <span className="border-border text-fg/90 mt-2 block max-h-40 overflow-y-auto border-t pt-2 leading-relaxed whitespace-pre-line">
              {citation.snippet}
            </span>
          ) : null}
          {resolvedDocId ? (
            <span className="border-border mt-2.5 flex flex-wrap gap-1.5 border-t pt-2">
              <a
                href={getDocumentDownloadUrl(resolvedDocId)}
                download
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-emerald-400/40 bg-emerald-400/15 px-2.5 py-1.5 font-mono text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-400/25"
              >
                <Download aria-hidden className="size-3.5" />
                {isCsvOrTableDoc(resolvedDocId)
                  ? "Download CSV"
                  : "Download PDF / Doc"}
              </a>
              {!isCsvOrTableDoc(resolvedDocId) && onOpenDocument ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenDocument({
                      docId: resolvedDocId,
                      page: resolvedPage,
                    });
                  }}
                  className="inline-flex items-center justify-center gap-1 rounded border border-sky-400/40 bg-sky-400/10 px-2.5 py-1.5 font-mono text-[11px] font-medium text-sky-300 transition-colors hover:bg-sky-400/20"
                >
                  <BookOpen aria-hidden className="size-3.5" />
                  Preview
                  {resolvedPage != null ? ` p.${resolvedPage}` : ""}
                </button>
              ) : null}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
