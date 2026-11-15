"use client";

import { KpiTile } from "@/components/ui/kpi-tile";
import type { LiveTelemetrySample } from "@/lib/api/types";
import { fmtNum } from "@/lib/format";

function rawHint(
  label: string,
  raw: number | null | undefined,
  unit: string,
  digits = 2,
) {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return `${label}: smoothed stream`;
  }
  return `Raw transducer: ${raw.toFixed(digits)} ${unit}`;
}

export function LiveSensorGrid({ sample }: { sample: LiveTelemetrySample }) {
  const { config, raw_sensors: raw } = sample;
  const hasRigSensors = Boolean(
    raw &&
      (raw.flame_temp_k != null ||
        raw.radiative_heat_flux_kw_m2 != null ||
        raw.flame_radius_mm != null),
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Oxygen (O₂)"
          value={fmtNum(config.oxygen_pct, 1)}
          unit="%"
          hint={rawHint("O₂ sensor", raw?.oxygen_pct_raw, "%", 2)}
        />
        <KpiTile
          label="Cabin Pressure"
          value={fmtNum(config.pressure_kpa, 1)}
          unit="kPa"
          hint={rawHint("Baratron gauge", raw?.pressure_kpa_raw, "kPa", 2)}
        />
        <KpiTile
          label="HVAC Flow Velocity"
          value={fmtNum(config.flow_velocity_cm_s, 1)}
          unit="cm/s"
          hint={rawHint("Anemometer", raw?.flow_velocity_cm_s_raw, "cm/s", 2)}
        />
        <KpiTile
          label="Gravity Level"
          value={fmtNum(config.gravity_g, 2)}
          unit="g"
          hint={rawHint("Accelerometer", raw?.gravity_g_raw, "g", 3)}
        />
      </div>

      {hasRigSensors ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiTile
            label="Rig Flame Temperature"
            value={fmtNum(raw?.flame_temp_k, 1)}
            unit="K"
            hint="Thermocouple / IR pyrometer channel"
          />
          <KpiTile
            label="Radiative Heat Flux"
            value={fmtNum(raw?.radiative_heat_flux_kw_m2, 2)}
            unit="kW/m²"
            hint="Chamber radiometer readout"
          />
          <KpiTile
            label="Flame Radius"
            value={fmtNum(raw?.flame_radius_mm, 2)}
            unit="mm"
            hint="Optical flame-front tracking"
          />
        </div>
      ) : null}
    </div>
  );
}
