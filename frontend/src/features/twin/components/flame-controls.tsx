"use client";

import { Card, CardBody } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { FlameParams } from "../lib/flame-physics";
import {
  DILUENT_OPTIONS,
  FLOW_DIRECTIONS,
  FUEL_OPTIONS,
  GEOMETRY_OPTIONS,
  GRAVITY_PRESETS,
  SPEED_OPTIONS,
} from "../lib/flame-scenes";
import { ParamControl } from "./param-control";

interface FlameControlsProps {
  params: FlameParams;
  speed: number;
  onChange: <K extends keyof FlameParams>(key: K, value: FlameParams[K]) => void;
  onSpeedChange: (speed: number) => void;
}

export function FlameControls({ params, speed, onChange, onSpeedChange }: FlameControlsProps) {
  const gravityPreset = GRAVITY_PRESETS.find((g) => Math.abs(Number(g.value) - params.gravity_g) < 1e-9);
  const gravityOptions = gravityPreset
    ? GRAVITY_PRESETS
    : [{ value: "custom", label: `Custom (${params.gravity_g} g)` }, ...GRAVITY_PRESETS];

  return (
    <Card>
      <CardBody className="space-y-5 py-5">
        <ParamControl
          id="flame-o2"
          label="Oxygen (O₂)"
          unit="%"
          value={params.oxygen_pct}
          sliderMin={15}
          sliderMax={40}
          step={0.5}
          hardMin={0}
          hardMax={100}
          onChange={(v) => onChange("oxygen_pct", v)}
        />
        <ParamControl
          id="flame-pressure"
          label="Cabin pressure"
          unit="kPa"
          value={params.pressure_kpa}
          sliderMin={20}
          sliderMax={101.3}
          step={0.5}
          hardMin={1}
          hardMax={500}
          onChange={(v) => onChange("pressure_kpa", v)}
        />
        <ParamControl
          id="flame-flow"
          label="Ventilation flow"
          unit="cm/s"
          value={params.flow_velocity_cm_s}
          sliderMin={0}
          sliderMax={50}
          step={0.5}
          hardMin={0}
          hardMax={1000}
          onChange={(v) => onChange("flow_velocity_cm_s", v)}
        />
        <ParamControl
          id="flame-gravity"
          label="Gravity"
          unit="g"
          value={params.gravity_g}
          sliderMin={0}
          sliderMax={2}
          step={0.01}
          hardMin={0}
          hardMax={20}
          decimals={2}
          onChange={(v) => onChange("gravity_g", v)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Gravity level"
            value={gravityPreset?.value ?? "custom"}
            options={gravityOptions}
            onChange={(v) => v !== "custom" && onChange("gravity_g", Number(v))}
          />
          <Select
            label="Fuel material"
            value={params.fuel_material}
            options={FUEL_OPTIONS}
            onChange={(v) => onChange("fuel_material", v)}
          />
          <Select
            label="Diluent gas"
            value={params.diluent_gas}
            options={DILUENT_OPTIONS}
            onChange={(v) => onChange("diluent_gas", v)}
          />
          <Select
            label="Fuel geometry"
            value={params.geometry}
            options={GEOMETRY_OPTIONS}
            onChange={(v) => onChange("geometry", v)}
          />
          <Select
            label="Flow direction"
            className="col-span-2"
            value={params.flowDirection}
            options={FLOW_DIRECTIONS}
            onChange={(v) => onChange("flowDirection", v)}
          />
          <Select
            label="Simulation speed"
            className="col-span-2"
            value={SPEED_OPTIONS.find((s) => Number(s.value) === speed)?.value ?? "1"}
            options={SPEED_OPTIONS}
            onChange={(v) => onSpeedChange(Number(v))}
          />
        </div>
      </CardBody>
    </Card>
  );
}
