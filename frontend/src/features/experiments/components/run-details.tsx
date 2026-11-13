import { FileText } from "lucide-react";
import type { TestRunRecord } from "@/lib/api/types";
import { fmtCmS, fmtG, fmtKpa, fmtNum, fmtPct } from "@/lib/format";

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
export function RunDetails({ run }: { run: TestRunRecord }) {
  const rateUnit = isDropletLike(run) ? "mm²/s (burning-rate K)" : "mm/s (spread rate)";
  const rate = run.spread_or_burn_rate;

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

      <p className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2/50 px-3 py-2 text-xs text-muted">
        <FileText aria-hidden className="size-3.5 shrink-0" />
        <span>Provenance</span>
        <span className="font-mono text-fg">[{run.experiment_id}]</span>
        <span aria-hidden>→</span>
        {run.source_doc_id ? (
          <span className="font-mono text-fg">
            [{run.source_doc_id}
            {run.source_page != null ? ` p.${run.source_page}` : ""}]
          </span>
        ) : (
          <span>no source document recorded</span>
        )}
      </p>
    </div>
  );
}
