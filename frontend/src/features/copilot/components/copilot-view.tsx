"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessagesSquare, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { AskRequest, AskResponse, DocumentSummary } from "@/lib/api/types";
import {
  formatCabinSummary,
  useCabinScenario,
} from "@/lib/cabin-scenario/cabin-scenario-context";
import { useAskCopilot, useDocuments } from "../hooks";
import { AnswerCard } from "./answer-card";
import {
  DocumentReaderModal,
  type DocumentReaderTarget,
} from "./document-reader";
import { DroppedClaims } from "./dropped-claims";
import { EmberBackdrop } from "./ember-backdrop";
import { QuestionInput } from "./question-input";
import { RelevantPapers } from "./relevant-papers";
import { StarterPrompts } from "./starter-prompts";

type Turn =
  | { id: number; req: AskRequest; scenarioLabel?: string; status: "pending" }
  | {
      id: number;
      req: AskRequest;
      scenarioLabel?: string;
      status: "success";
      response: AskResponse;
    }
  | {
      id: number;
      req: AskRequest;
      scenarioLabel?: string;
      status: "error";
      error: unknown;
    };

// Preserve conversation turns and scenario checkbox across sidebar tab navigations in the session
let cachedTurns: Turn[] = [];
let cachedUseScenario = false;
let cachedNextId = 1;

/** SI Co-Pilot: ask grounded questions; every claim is verified against the NASA corpus and experiment database. */
export function CopilotView() {
  const ask = useAskCopilot();
  const { data: documents } = useDocuments();
  const { config: cabinConfig, presetName } = useCabinScenario();
  const [turns, setTurnsState] = useState<Turn[]>(() => cachedTurns);
  const [useScenario, setUseScenarioState] = useState<boolean>(
    () => cachedUseScenario,
  );
  const [readerTarget, setReaderTarget] = useState<DocumentReaderTarget | null>(
    null,
  );
  const nextId = useRef(cachedNextId);
  const scrollToAnswerId = useRef<number | null>(null);

  useEffect(() => {
    const id = scrollToAnswerId.current;
    if (id === null || turns.find((turn) => turn.id === id)?.status !== "success") return;

    const answer = document.getElementById(`copilot-answer-${id}`);
    if (!answer) return;
    const appHeader = document.querySelector<HTMLElement>("[data-app-header]");
    const headerHeight = appHeader?.getBoundingClientRect().height ?? 0;
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const targetY = Math.min(
      maxY,
      Math.max(0, window.scrollY + answer.getBoundingClientRect().top - headerHeight - 12),
    );
    const startY = window.scrollY;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, targetY);
      scrollToAnswerId.current = null;
      return;
    }

    let frame = 0;
    const startedAt = performance.now();
    const duration = Math.min(2400, Math.max(1500, Math.abs(targetY - startY) * 1.8));
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      window.scrollTo(0, startY + (targetY - startY) * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
      else if (scrollToAnswerId.current === id) scrollToAnswerId.current = null;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [turns]);

  const setTurns = (updater: Turn[] | ((prev: Turn[]) => Turn[])) => {
    setTurnsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      cachedTurns = next;
      return next;
    });
  };

  const setUseScenario = (value: boolean) => {
    cachedUseScenario = value;
    setUseScenarioState(value);
  };

  const documentsById = useMemo(() => {
    const map = new Map<string, DocumentSummary>();
    for (const d of documents ?? []) {
      map.set(d.doc_id.toUpperCase(), d);
    }
    return map;
  }, [documents]);

  const settle = (id: number, turn: Turn) =>
    setTurns((ts) => ts.map((t) => (t.id === id ? turn : t)));

  const run = (id: number, req: AskRequest, scenarioLabel?: string) =>
    ask.mutate(req, {
      onSuccess: (response) =>
        settle(id, { id, req, scenarioLabel, status: "success", response }),
      onError: (error) =>
        settle(id, { id, req, scenarioLabel, status: "error", error }),
    });

  const submit = (question: string) => {
    if (ask.isPending) return;
    const req: AskRequest = useScenario
      ? { question, scenario: { ...cabinConfig } }
      : { question };
    const scenarioLabel = useScenario
      ? formatCabinSummary(cabinConfig, presetName)
      : undefined;
    const id = nextId.current++;
    cachedNextId = nextId.current;
    scrollToAnswerId.current = id;
    setTurns((ts) => [{ id, req, scenarioLabel, status: "pending" }, ...ts]);
    run(id, req, scenarioLabel);
  };

  const retry = (turn: Turn) => {
    if (ask.isPending) return;
    scrollToAnswerId.current = turn.id;
    settle(turn.id, {
      id: turn.id,
      req: turn.req,
      scenarioLabel: turn.scenarioLabel,
      status: "pending",
    });
    run(turn.id, turn.req, turn.scenarioLabel);
  };

  const clearHistory = () => {
    if (ask.isPending) return;
    scrollToAnswerId.current = null;
    setTurns([]);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-muted font-mono text-[11px] tracking-wide">
            MODULE 04
          </p>
          <h1 className="text-xl font-semibold">SI Co-Pilot</h1>
          <p className="text-muted max-w-2xl text-sm">
            Ask grounded questions about the experiments and documents. Every
            sentence in an answer cites its source; claims the evidence
            can&apos;t support are removed.
          </p>
        </div>
        {turns.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={clearHistory}
            disabled={ask.isPending}
          >
            <Trash2 aria-hidden className="size-3.5" />
            Clear history
          </Button>
        ) : null}
      </header>

      <Card
        aria-busy={ask.isPending}
        className="copilot-ember-card relative isolate overflow-hidden bg-black"
      >
        <EmberBackdrop loading={ask.isPending} />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/20"
        />
        <CardBody
          inert={ask.isPending}
          data-loading={ask.isPending}
          className="copilot-question-content relative z-10 space-y-5"
        >
          <StarterPrompts
            onPick={submit}
            disabled={ask.isPending}
            useScenario={useScenario}
          />
          <QuestionInput
            onSubmit={submit}
            pending={ask.isPending}
            useScenario={useScenario}
            onUseScenarioChange={setUseScenario}
            cabinConfig={cabinConfig}
            presetName={presetName}
          />
        </CardBody>
      </Card>

      <p role="status" className="sr-only">
        {ask.isPending
          ? "Asking the Co-Pilot…"
          : turns[0]?.status === "success"
            ? "Answer ready."
            : ""}
      </p>

      {turns.length === 0 ? (
        <Card>
          <EmptyState
            icon={MessagesSquare}
            title="No questions yet"
            description="Pick a starter question or type your own. Answers appear here, newest first."
          />
        </Card>
      ) : (
        <ol aria-label="Conversation, newest first" className="min-h-screen space-y-6">
          {turns.map((turn) => (
            <li key={turn.id}>
              <TurnView
                turn={turn}
                onRetry={() => retry(turn)}
                retryDisabled={ask.isPending}
                documentsById={documentsById}
                onOpenDocument={setReaderTarget}
              />
            </li>
          ))}
        </ol>
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

function TurnView({
  turn,
  onRetry,
  retryDisabled,
  documentsById,
  onOpenDocument,
}: {
  turn: Turn;
  onRetry: () => void;
  retryDisabled: boolean;
  documentsById: ReadonlyMap<string, DocumentSummary>;
  onOpenDocument: (target: DocumentReaderTarget) => void;
}) {
  const scenarioNote = turn.req.scenario ? (
    <div className="border-accent/30 bg-accent/10 text-accent inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[11px]">
      <SlidersHorizontal aria-hidden className="size-3 shrink-0" />
      <span>
        Cabin configuration attached:{" "}
        {turn.scenarioLabel ?? formatCabinSummary(turn.req.scenario)}
      </span>
    </div>
  ) : null;

  if (turn.status === "pending") {
    return (
      <div className="space-y-2" aria-busy="true">
        {scenarioNote}
        <div className="rounded-card border-border bg-surface space-y-4 border p-5">
          <h3 className="text-fg text-base font-semibold">
            {turn.req.question}
          </h3>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (turn.status === "error") {
    return (
      <div className="space-y-2">
        {scenarioNote}
        <ErrorState
          title={`Couldn't answer: “${turn.req.question}”`}
          error={turn.error}
          onRetry={onRetry}
          retrying={retryDisabled}
        />
      </div>
    );
  }

  const { response } = turn;

  return (
    <div className="space-y-3">
      {scenarioNote}
      <AnswerCard
        id={`copilot-answer-${turn.id}`}
        response={response}
        question={turn.req.question}
        documentsById={documentsById}
        onOpenDocument={onOpenDocument}
      />
      <RelevantPapers
        response={response}
        documentsById={documentsById}
        onOpenDocument={onOpenDocument}
      />
      <DroppedClaims claims={response.dropped_claims} />
    </div>
  );
}
