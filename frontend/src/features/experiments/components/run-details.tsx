import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TestRunRecord } from "@/lib/api/types";
import { fmtCmS, fmtG, fmtKpa, fmtNum, fmtPct } from "@/lib/format";
import { missingOutcomes, ORIGIN_LABEL, reportedMissingChannels, type DataOrigin } from "../lib/run-quality";

const isDropletLike = (r: TestRunRecord) => r.fuel_geometry === "Droplet" || r.fuel_geometry === "Gaseous";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm break-words text-fg tabular-nums">
        {value}
      </dd>
    </div>
  );
}

/** schema_v1 record fields plus provenance ([EXP] → [DOC p.]). */
export function RunDetails({
  run,
  origin,
  sourceAvailable,
  sourcePageAvailable,
  telemetryAvailable,
  onOpenSource,
}: {
  run: TestRunRecord;
  origin: DataOrigin;
  sourceAvailable: boolean | null;
  sourcePageAvailable: boolean | null;
  telemetryAvailable: boolean | null;
  onOpenSource: () => void;
}) {
  const rateUnit = isDropletLike(run) ? "mm²/s (burning-rate K)" : "mm/s (spread rate)";
  const rate = run.spread_or_burn_rate;
  const missing = missingOutcomes(run);
  const missingChannels = reportedMissingChannels(run);

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Field label="Program" value={run.program} />
        <Field label="Fuel material" value={run.fuel_material} />
        <Field label="Geometry" value={run.fuel_geometry} />
        <Field label="Gravity" value={fmtG(run.gravity_g)} />
        <Field label="Oxygen" value={fmtPct(run.oxygen_pct)} />
        <Field label="Pressure" value={fmtKpa(run.pressure_kpa)} />
        <Field label="Flow velocity" value={fmtCmS(run.flow_velocity_cm_s)} />
        <Field label="Diluent" value={run.diluent_gas} />
        <Field label="Regime" value={run.combustion_regime} />
        <Field label={`Spread / burn rate, ${rateUnit}`} value={fmtNum(rate, 3)} />
        <Field
          label="Peak radiative flux"
          value={run.peak_radiative_flux_kw_m2 == null ? "—" : `${fmtNum(run.peak_radiative_flux_kw_m2, 2)} kW/m²`}
        />
        <Field label="Limiting O₂ index" value={fmtPct(run.limiting_oxygen_index_pct, 2)} />
        <Field label="Burn duration" value={run.burn_duration_s == null ? "—" : `${fmtNum(run.burn_duration_s, 1)} s`} />
      </dl>

      <div className="space-y-2 rounded-md border border-border bg-surface-2/50 px-3 py-2 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-fg">Data quality</span>
          <Badge tone={origin === "proxy" ? "warning" : origin === "sourced" ? "success" : "neutral"}>{ORIGIN_LABEL[origin]}</Badge>
        </div>
        {origin === "proxy" ? <p>Illustrative proxy values; check the source before using them as measurements.</p> : null}
        {origin === "unverified" ? <p>The dataset does not explicitly identify this run as proxy or sourced.</p> : null}
        <p>{missing.length ? `Missing standard outcomes: ${missing.join(", ")}.` : "All four standard outcomes are recorded."}</p>
        {missingChannels != null ? <p>Source-reported missing channels: {missingChannels}.</p> : null}
        {telemetryAvailable === false ? <p>No stored time series is available for this run.</p> : null}
        {sourcePageAvailable === false ? <p>The cited page is not present in the document copy available here.</p> : null}
      </div>

      <p className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2/50 px-3 py-2 text-xs text-muted">
        <FileText aria-hidden className="size-3.5 shrink-0" />
        <span>Provenance</span>
        <span className="font-mono text-fg">[{run.experiment_id}]</span>
        <span aria-hidden>→</span>
        {run.source_doc_id ? (
          sourceAvailable ? (
            <button type="button" onClick={onOpenSource} className="rounded font-mono text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent">
              Open [{run.source_doc_id}{sourcePageAvailable !== false && run.source_page != null ? ` p.${run.source_page}` : ""}]
            </button>
          ) : (
            <span className="font-mono text-fg">
              [{run.source_doc_id}{run.source_page != null ? ` p.${run.source_page}` : ""}]
              {sourceAvailable === false ? " · not in the document library" : ""}
            </span>
          )
        ) : (
          <span>no source document recorded</span>
        )}
      </p>
    </div>
  );
}
