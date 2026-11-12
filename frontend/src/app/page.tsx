"use client";

// TEMPORARY UI-kit showcase (F4.1). Replaced by the Overview feature view in F5.
import { useState } from "react";
import { Flame } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { KpiTile } from "@/components/ui/kpi-tile";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const FUELS = ["PMMA", "Cotton-Fiberglass", "Nomex", "Heptane", "Methanol"] as const;
const RISK = ["low", "elevated", "high", "critical"] as const;
const RISK_BG = {
  low: "bg-risk-low",
  elevated: "bg-risk-elevated",
  high: "bg-risk-high",
  critical: "bg-risk-critical",
} as const;

export default function Home() {
  const [o2, setO2] = useState(21);
  const [fuel, setFuel] = useState<(typeof FUELS)[number]>("Cotton-Fiberglass");
  const [gravity, setGravity] = useState<"0" | "0.16" | "0.38" | "1">("0");
  const [question, setQuestion] = useState("");

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">UI kit</h1>
        <p className="text-sm text-muted">Temporary showcase of design tokens and components.</p>
      </header>

      <Card>
        <CardHeader title="Tokens" subtitle="Risk bands and connection states" />
        <CardBody className="flex flex-wrap gap-3">
          {RISK.map((r) => (
            <span key={r} className="flex items-center gap-2 text-xs text-muted">
              <span className={`size-4 rounded ${RISK_BG[r]}`} /> risk-{r}
            </span>
          ))}
          <Badge tone="success" dot>
            Live
          </Badge>
          <Badge tone="warning" dot>
            Mock
          </Badge>
          <Badge tone="danger" dot>
            Offline
          </Badge>
          <Badge tone="info">Info</Badge>
          <Badge>Neutral</Badge>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile label="Test runs" value={50} hint="schema v1" />
        <KpiTile label="Oxygen" value={o2.toFixed(1)} unit="%" />
        <KpiTile label="Chunks" value={null} loading />
      </div>

      <Card>
        <CardHeader
          title="Controls"
          subtitle="Slider, select, segmented control, textarea"
          action={<Button size="sm">Action</Button>}
        />
        <CardBody className="grid gap-6 sm:grid-cols-2">
          <Slider
            label="Oxygen concentration"
            value={o2}
            onChange={setO2}
            min={15}
            max={40}
            step={0.5}
            unit="%"
            format={(v) => v.toFixed(1)}
            hint="ISS nominal is 21 %."
          />
          <Select label="Fuel material" value={fuel} options={FUELS} onChange={setFuel} />
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted">Gravity</p>
            <SegmentedControl
              label="Gravity"
              value={gravity}
              onChange={setGravity}
              options={[
                { value: "0", label: "0 g" },
                { value: "0.16", label: "Moon" },
                { value: "0.38", label: "Mars" },
                { value: "1", label: "Earth" },
              ]}
            />
          </div>
          <Textarea
            label="Ask the co-pilot"
            placeholder="Which runs match a 34 % O₂ Artemis cabin?"
            value={question}
            onChange={(e) => setQuestion(e.currentTarget.value)}
            hint="Answers cite their sources."
          />
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button size="icon" variant="outline" aria-label="Ignite">
              <Flame aria-hidden className="size-4" />
            </Button>
            <Button disabled>Disabled</Button>
            <Spinner size="sm" label="Loading…" />
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader title="Skeleton" as="h3" />
          <CardBody className="space-y-2" aria-busy>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Empty state" as="h3" />
          <EmptyState title="No matching runs" description="Try widening the filters." />
        </Card>
        <ErrorState
          error={new ApiError(0, "NETWORK_ERROR", "Backend unreachable")}
          onRetry={() => undefined}
        />
      </div>
      <ErrorState
        title="Request rejected"
        error={new ApiError(422, "VALIDATION_ERROR", "oxygen_pct must be <= 40")}
        onRetry={() => undefined}
      />
    </div>
  );
}
