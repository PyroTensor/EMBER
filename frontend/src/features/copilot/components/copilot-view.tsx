"use client";

import { useRef, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { AskRequest, AskResponse } from "@/lib/api/types";
import { useAskCopilot } from "../hooks";
import { AnswerCard } from "./answer-card";
import { DroppedClaims } from "./dropped-claims";
import { EvidenceList } from "./evidence-list";
import { ISS_SCENARIO, QuestionInput } from "./question-input";
import { StarterPrompts } from "./starter-prompts";

type Turn =
  | { id: number; req: AskRequest; status: "pending" }
  | { id: number; req: AskRequest; status: "success"; response: AskResponse }
  | { id: number; req: AskRequest; status: "error"; error: unknown };

/** SI Co-Pilot: ask grounded questions; the thread (newest first) lives in this view's state. */
export function CopilotView() {
  const ask = useAskCopilot();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [useScenario, setUseScenario] = useState(false);
  const nextId = useRef(1);

  const settle = (id: number, turn: Turn) => setTurns((ts) => ts.map((t) => (t.id === id ? turn : t)));

  const run = (id: number, req: AskRequest) =>
    ask.mutate(req, {
      onSuccess: (response) => settle(id, { id, req, status: "success", response }),
      onError: (error) => settle(id, { id, req, status: "error", error }),
    });

  const submit = (question: string) => {
    if (ask.isPending) return;
    const req: AskRequest = useScenario ? { question, scenario: { ...ISS_SCENARIO } } : { question };
    const id = nextId.current++;
    setTurns((ts) => [{ id, req, status: "pending" }, ...ts]);
    run(id, req);
  };

  const retry = (turn: Turn) => {
    if (ask.isPending) return;
    settle(turn.id, { id: turn.id, req: turn.req, status: "pending" });
    run(turn.id, turn.req);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <header className="space-y-1">
        <p className="font-mono text-[11px] tracking-wide text-muted">MODULE 04</p>
        <h1 className="text-xl font-semibold">SI Co-Pilot</h1>
        <p className="max-w-2xl text-sm text-muted">
          Ask grounded questions about the experiments and documents. Every sentence in an answer cites its source;
          claims the evidence can&apos;t support are removed.
        </p>
      </header>

      <Card>
        <CardBody className="space-y-5">
          <StarterPrompts onPick={submit} disabled={ask.isPending} />
          <QuestionInput
            onSubmit={submit}
            pending={ask.isPending}
            useScenario={useScenario}
            onUseScenarioChange={setUseScenario}
          />
        </CardBody>
      </Card>

      <p role="status" className="sr-only">
        {ask.isPending ? "Asking the Co-Pilot…" : turns[0]?.status === "success" ? "Answer ready." : ""}
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
        <ol aria-label="Conversation, newest first" className="space-y-6">
          {turns.map((turn) => (
            <li key={turn.id}>
              <TurnView turn={turn} onRetry={() => retry(turn)} retryDisabled={ask.isPending} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TurnView({ turn, onRetry, retryDisabled }: { turn: Turn; onRetry: () => void; retryDisabled: boolean }) {
  const scenarioNote = turn.req.scenario ? (
    <p className="font-mono text-[11px] text-muted">ISS scenario attached</p>
  ) : null;

  if (turn.status === "pending") {
    return (
      <div className="space-y-2" aria-busy="true">
        {scenarioNote}
        <div className="space-y-4 rounded-card border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold text-fg">{turn.req.question}</h3>
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
  const evidence = response.evidence ?? [];
  const showSide = response.supported !== false || evidence.length > 0;

  return (
    <div className="space-y-2">
      {scenarioNote}
      <div className={showSide ? "grid gap-6 lg:grid-cols-12" : undefined}>
        <div className="min-w-0 space-y-3 lg:col-span-7">
          <AnswerCard response={response} question={turn.req.question} />
          <DroppedClaims claims={response.dropped_claims} />
        </div>
        {showSide ? (
          <Card className="min-w-0 lg:col-span-5">
            <CardHeader as="h3" title="Retrieved evidence" subtitle={`${evidence.length} items, grouped by source`} />
            <CardBody>
              <EvidenceList evidence={evidence} />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
