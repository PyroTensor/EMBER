"use client";

import { ChevronRight, ShieldAlert } from "lucide-react";

/** Sentences removed by citation_check. Collapsible; renders nothing when there are none. */
export function DroppedClaims({ claims }: { claims: readonly string[] | undefined }) {
  if (!claims?.length) return null;
  const n = claims.length;

  return (
    <details className="group rounded-md border border-mock/30 bg-mock/5 text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-mock [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-3.5 transition-transform group-open:rotate-90" />
        <ShieldAlert aria-hidden className="size-3.5" />
        <span>
          {n} unverified {n === 1 ? "sentence" : "sentences"} removed by the citation check
        </span>
      </summary>
      <ul className="list-disc space-y-1 border-t border-mock/20 py-2 pr-3 pl-8 leading-relaxed text-muted">
        {claims.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
    </details>
  );
}
