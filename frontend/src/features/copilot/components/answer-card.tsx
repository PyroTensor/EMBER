"use client";

import { Fragment, type ReactNode } from "react";
import { SearchX } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { AskResponse, Route } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { findCitation, tokenize } from "../lib/citations";
import { CitationChip } from "./citation-chip";

const ROUTE_LABEL: Record<Route, string> = {
  facts: "Facts (SQL)",
  search: "Document search",
  compare: "Scenario compare",
  out_of_scope: "Out of scope",
};

/** Minimal inline markdown: **bold** only (the graph sometimes bolds a finding). */
function inline(text: string): ReactNode[] {
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

function AnswerText({ response }: { response: AskResponse }) {
  const paragraphs = (response.answer ?? "").split(/\n{1,}/).filter((p) => p.trim());
  return (
    <div className="space-y-3 text-sm leading-relaxed text-fg/90">
      {paragraphs.map((p, pi) => (
        <p key={pi}>
          {tokenize(p).map((t, ti) =>
            t.type === "cite" ? (
              <CitationChip key={ti} tag={t.value} citation={findCitation(t.value, response.citations)} />
            ) : (
              <Fragment key={ti}>{inline(t.value)}</Fragment>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

/** Shown instead of an answer when the graph could not ground one (supported=false). */
function NoDataPanel({ message }: { message: string | undefined }) {
  return (
    <div role="status" className="flex gap-3 rounded-md border border-mock/30 bg-mock/5 p-4">
      <SearchX aria-hidden className="mt-0.5 size-5 shrink-0 text-mock" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-fg">No data in the evidence base</p>
        <p className="text-xs text-muted">
          {message ?? "The database and document corpus contain no verified evidence for this question."}
        </p>
        <p className="text-xs text-muted">
          Try asking about flame spread, oxygen limits, ventilation, gravity or a specific run (e.g. EXP-0012).
        </p>
      </div>
    </div>
  );
}

interface AnswerCardProps {
  response: AskResponse;
  /** The question this answers (shown as the card heading). */
  question?: string;
  className?: string;
}

/** One Co-Pilot answer: route / support / rewrite badges, then the cited answer or the No-data panel. */
export function AnswerCard({ response, question, className }: AnswerCardProps) {
  const supported = response.supported !== false;
  const rewrites = response.rewrites ?? 0;
  const routeTone: BadgeTone = response.route === "out_of_scope" ? "warning" : "info";

  return (
    <article className={cn("space-y-4 rounded-card border border-border bg-surface p-5", className)}>
      <header className="space-y-2">
        {question ? <h3 className="text-sm font-semibold text-fg">{question}</h3> : null}
        <div className="flex flex-wrap items-center gap-2">
          {response.route ? (
            <Badge tone={routeTone} title="Route chosen by the question router">
              {ROUTE_LABEL[response.route]}
            </Badge>
          ) : null}
          <Badge tone={supported ? "success" : "danger"} dot>
            {supported ? "Supported" : "Unsupported"}
          </Badge>
          <Badge title="Query rewrites before enough evidence was found">
            {rewrites} {rewrites === 1 ? "rewrite" : "rewrites"}
          </Badge>
          {response.trace_id ? (
            <span className="ml-auto font-mono text-[10px] text-muted" title="Trace id">
              {response.trace_id}
            </span>
          ) : null}
        </div>
      </header>

      {supported ? <AnswerText response={response} /> : <NoDataPanel message={response.answer} />}
    </article>
  );
}
