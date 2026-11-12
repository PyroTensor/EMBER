"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileText, FlaskConical, X } from "lucide-react";
import type { Citation } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { tagLabel } from "../lib/citations";

interface CitationChipProps {
  /** The tag as it appears in the answer, e.g. "[DOC-01 p.1]". */
  tag: string;
  /** The matching entry from AskResponse.citations, if any. */
  citation: Citation | undefined;
}

const POPOVER_MAX_W = 320;
const EDGE = 8;

/** Inline citation button; click opens a popover with the source and snippet. Escape / outside click closes. */
export function CitationChip({ tag, citation }: CitationChipProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ left: 0, width: POPOVER_MAX_W });
  const popoverId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const isDoc = citation?.kind === "doc" || (!citation && tag.startsWith("[DOC-"));
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
      const offset = Math.max(EDGE - rect.left, Math.min(0, vw - EDGE - width - rect.left));
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
          !citation && "border-dashed opacity-80",
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
          className="absolute top-full z-20 mt-1.5 block rounded-md border border-border bg-surface p-3 text-left font-sans text-xs shadow-xl"
        >
          <span className="flex items-start justify-between gap-2">
            <span className="block">
              <span className="block text-[10px] font-medium tracking-wide text-muted uppercase">
                {isDoc ? "Document" : "Experiment"}
              </span>
              <span className="block font-mono text-sm text-fg">
                {citation
                  ? isDoc
                    ? `${citation.doc_id ?? tagLabel(tag)}${citation.page != null ? ` · page ${citation.page}` : ""}`
                    : (citation.experiment_id ?? tagLabel(tag))
                  : tagLabel(tag)}
              </span>
              {citation && !isDoc && citation.doc_id ? (
                <span className="block text-[11px] text-muted">
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
              className="rounded p-0.5 text-muted hover:bg-surface-2 hover:text-fg"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </span>
          <span className="mt-2 block max-h-48 overflow-y-auto border-t border-border pt-2 leading-relaxed whitespace-pre-line text-fg/90">
            {citation?.snippet || "This tag has no matching entry in the response's citations."}
          </span>
        </span>
      ) : null}
    </span>
  );
}
