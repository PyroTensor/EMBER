// Friendly aliases over the generated contract types. Never hand-write shapes here: edit
// contracts/openapi_v1.yaml and run `npm run gen:api` instead.
import type { components } from "./schema";

type Schemas = components["schemas"];

export type Health = Schemas["Health"];
export type CabinConfig = Schemas["CabinConfig"];
export type Preset = Schemas["Preset"];
export type Contribution = Schemas["Contribution"];
export type CabinEvaluation = Schemas["CabinEvaluation"];
export type RankWeights = Schemas["RankWeights"];
export type RankRequest = Schemas["RankRequest"];
export type RankedExperiment = Schemas["RankedExperiment"];
export type RankResponse = Schemas["RankResponse"];
export type Telemetry = Schemas["Telemetry"];
export type AskRequest = Schemas["AskRequest"];
export type AskResponse = Schemas["AskResponse"];
export type Citation = Schemas["Citation"];
export type Evidence = Schemas["Evidence"];
export type ErrorResponse = Schemas["ErrorResponse"];

/** One combustion test run (contracts/schema_v1.json). */
export type TestRunRecord = NonNullable<RankedExperiment["record"]>;

export type Program = TestRunRecord["program"];
export type FuelMaterial = TestRunRecord["fuel_material"];
export type DiluentGas = TestRunRecord["diluent_gas"];
export type CombustionRegime = TestRunRecord["combustion_regime"];

export type RiskBand = NonNullable<CabinEvaluation["risk_band"]>;
export type Route = NonNullable<AskResponse["route"]>;

/** Optional query params for GET /api/experiments (mirrors the backend ExperimentFilters). */
export interface ExperimentFilters {
  program?: Program;
  fuel_material?: FuelMaterial;
  combustion_regime?: CombustionRegime;
  /** 0–1; matched within ±0.01 g. */
  gravity_g?: number;
}
