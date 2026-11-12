"use client";

import React, { useEffect, useState } from "react";
import { askCopilot, useDataMode } from "@/lib/api";
import type { AskResponse, Citation, Evidence } from "@/lib/types";

const STARTER_PROMPTS = [
  "Does low-speed ventilation make microgravity flames more dangerous?",
  "How does the Artemis 34% O2 / 56.5 kPa atmosphere change flame spread?",
  "What is a cool flame and why does it matter for droplet fires?",
] as const;

export default function CopilotPage() {
  const { useMock } = useDataMode();
  const [question, setQuestion] = useState<string>(STARTER_PROMPTS[0]);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const runQuery = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await askCopilot({ question: trimmed });
      setResponse(res);
      setSelectedCitation(res.citations[0] ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void askCopilot({ question: STARTER_PROMPTS[0] }).then((res) => {
      if (!cancelled) {
        setResponse(res);
        setSelectedCitation(res.citations[0] ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [useMock]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runQuery(question);
  };

  const groupedEvidence = React.useMemo(() => {
    const groups: Record<string, Evidence[]> = {
      sql_tool: [],
      hybrid_retriever: [],
      scenario_ranker: [],
    };
    for (const ev of response?.evidence ?? []) {
      const src = ev.source || "hybrid_retriever";
      if (!groups[src]) groups[src] = [];
      groups[src].push(ev);
    }
    return groups;
  }, [response]);

  return (
    <div className="space-y-8">
      <div className="border-b border-zinc-900 pb-5">
        <p className="font-mono text-xs text-zinc-500">04 / SI CO-PILOT</p>
        <h1 className="mt-1 text-xl font-semibold text-white">
          Grounded Fire-Safety Q&amp;A
        </h1>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {STARTER_PROMPTS.map((prompt) => {
            const isCurrent = question === prompt;
            return (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  setQuestion(prompt);
                  void runQuery(prompt);
                }}
                className={`rounded-md border px-3 py-1.5 text-left text-xs transition ${
                  isCurrent
                    ? "border-zinc-500 bg-zinc-900 text-white"
                    : "border-zinc-900 bg-zinc-950 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200"
                }`}
              >
                {prompt}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a microgravity combustion question..."
            className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? "Running..." : "Ask"}
          </button>
        </form>
      </section>

      {response && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Answer + Citations */}
          <div className="space-y-5 lg:col-span-7">
            <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-3 font-mono text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400">route: {response.route}</span>
                  <span className={response.supported ? "text-emerald-400" : "text-amber-400"}>
                    {response.supported ? "supported" : "no data"}
                  </span>
                  {response.rewrites > 0 && (
                    <span className="text-zinc-500">rewrites: {response.rewrites}</span>
                  )}
                </div>
                <span className="text-zinc-600">{response.trace_id}</span>
              </div>

              <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-zinc-100">
                {response.answer}
              </div>

              {response.dropped_claims.length > 0 && (
                <div className="mt-4 rounded border border-zinc-800 bg-black p-3 text-xs text-zinc-400">
                  <div className="font-mono text-[11px] text-amber-400">
                    Removed {response.dropped_claims.length} unverified sentence(s):
                  </div>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {response.dropped_claims.map((claim, idx) => (
                      <li key={idx}>{claim}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Citations */}
              <div className="mt-6 border-t border-zinc-900 pt-4">
                <div className="font-mono text-[11px] text-zinc-500">
                  CITATIONS ({response.citations.length})
                </div>

                {response.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {response.citations.map((cit, i) => {
                      const active = selectedCitation?.id === cit.id;
                      return (
                        <button
                          key={`${cit.id}-${i}`}
                          type="button"
                          onClick={() => setSelectedCitation(cit)}
                          className={`rounded border px-2.5 py-1 font-mono text-xs transition ${
                            active
                              ? "border-zinc-500 bg-zinc-800 text-white"
                              : "border-zinc-800 bg-black text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                          }`}
                        >
                          {cit.id}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedCitation && (
                  <div className="mt-3 rounded border border-zinc-900 bg-black p-3">
                    <div className="flex justify-between font-mono text-[11px] text-zinc-500">
                      <span className="text-zinc-200">{selectedCitation.id}</span>
                      <span>{selectedCitation.kind}</span>
                    </div>
                    <p className="mt-1.5 font-mono text-xs leading-relaxed text-zinc-400">
                      {selectedCitation.snippet}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-zinc-800 p-4 font-mono text-xs text-zinc-500">
              TODO(squad3-B): NASA-STD-6001B Compliance Brief Export (.md / PDF)
            </div>
          </div>

          {/* Evidence */}
          <div className="lg:col-span-5">
            <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-5">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3 font-mono text-xs">
                <span className="text-zinc-300">RETRIEVED EVIDENCE</span>
                <span className="text-zinc-500">{response.evidence.length}</span>
              </div>

              <div className="mt-4 space-y-4">
                {(["sql_tool", "hybrid_retriever", "scenario_ranker"] as const).map((nodeKey) => {
                  const items = groupedEvidence[nodeKey] ?? [];
                  if (items.length === 0) return null;
                  return (
                    <div key={nodeKey} className="space-y-2">
                      <div className="font-mono text-[11px] text-zinc-500">
                        {nodeKey} ({items.length})
                      </div>
                      {items.map((ev, idx) => (
                        <div
                          key={`${ev.id}-${idx}`}
                          className="rounded border border-zinc-900 bg-black p-3"
                        >
                          <div className="flex justify-between font-mono text-xs">
                            <span className="text-zinc-200">{ev.id}</span>
                            <span className="text-zinc-500">{ev.score.toFixed(2)}</span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-400">{ev.text}</p>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
