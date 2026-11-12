"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { LoaderCircle, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CabinConfig } from "@/lib/api/types";

/** ISS Standard cabin (same values as the "iss" preset); attached when "use current scenario" is on. */
export const ISS_SCENARIO: Readonly<CabinConfig> = Object.freeze({
  oxygen_pct: 21,
  pressure_kpa: 101.3,
  flow_velocity_cm_s: 10,
  gravity_g: 0,
  fuel_material: "Cotton-Fiberglass",
  diluent_gas: "N2",
});

/** Backend AskRequest.question limit. */
const QUESTION_MAX = 2000;

interface QuestionInputProps {
  onSubmit: (question: string) => void;
  pending: boolean;
  useScenario: boolean;
  onUseScenarioChange: (value: boolean) => void;
}

/** Question box: Enter submits, Shift+Enter adds a newline. Disabled while an answer is pending. */
export function QuestionInput({ onSubmit, pending, useScenario, onUseScenarioChange }: QuestionInputProps) {
  const [value, setValue] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const refocus = useRef(false);
  const canSubmit = !pending && value.trim().length > 0;

  // The textarea loses focus while disabled; give it back once the answer arrives.
  useEffect(() => {
    if (!pending && refocus.current) {
      refocus.current = false;
      formRef.current?.querySelector("textarea")?.focus();
    }
  }, [pending]);

  const submit = () => {
    const q = value.trim();
    if (!q || pending) return;
    refocus.current = true;
    onSubmit(q);
    setValue("");
  };

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form ref={formRef} onSubmit={onFormSubmit} className="space-y-3">
      <Textarea
        label="Your question"
        hint="Enter to send · Shift+Enter for a new line"
        placeholder="Ask about flame spread, oxygen limits, ventilation, gravity or a run such as EXP-0012…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={pending}
        maxLength={QUESTION_MAX}
        rows={3}
        className="min-h-20"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={useScenario}
            onChange={(e) => onUseScenarioChange(e.target.checked)}
            className="size-4 accent-accent"
          />
          <span>
            Use current scenario <span className="text-muted/80">(ISS Standard: 21 % O₂, 101.3 kPa, 0 g)</span>
          </span>
        </label>
        <Button type="submit" disabled={!canSubmit}>
          {pending ? (
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
          ) : (
            <SendHorizontal aria-hidden className="size-4" />
          )}
          {pending ? "Asking…" : "Ask"}
        </Button>
      </div>
    </form>
  );
}
