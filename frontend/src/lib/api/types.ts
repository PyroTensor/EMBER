// Friendly aliases over the generated contract types. Never hand-write shapes here: edit
// contracts/openapi_v1.yaml and run `npm run gen:api` instead.
import type { components, paths } from "./schema";

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
export type EvidenceSource = Schemas["EvidenceSource"];

/** One combustion test run (contracts/schema_v1.json). */
export type TestRunRecord = NonNullable<RankedExperiment["record"]>;

export type Program = Schemas["Program"];
export type FuelMaterial = Schemas["FuelMaterial"];
export type DiluentGas = Schemas["DiluentGas"];
export type CombustionRegime = Schemas["CombustionRegime"];

export type RiskBand = NonNullable<CabinEvaluation["risk_band"]>;
export type Route = NonNullable<AskResponse["route"]>;

/** Optional query params for GET /api/experiments (gravity_g is matched within ±0.01 g). */
export type ExperimentFilters = NonNullable<paths["/api/experiments"]["get"]["parameters"]["query"]>;
