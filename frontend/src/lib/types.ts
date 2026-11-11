/**
 * Hand-mirrored from contracts/schema_v1.json + contracts/openapi_v1.yaml (components).
 * Keep field names byte-identical to the contract.
 * TODO(squad3-A): replace with codegen from OpenAPI (e.g. openapi-typescript).
 */

// ---------- schema_v1 enums ----------
export const PROGRAMS = ["BASS-II", "SoFIE", "FLEX", "ACME"] as const;
export const FUEL_MATERIALS = ["PMMA", "Cotton-Fiberglass", "Nomex", "Heptane", "Methanol"] as const;
export const FUEL_GEOMETRIES = ["Flat Sheet", "Rod", "Droplet", "Gaseous"] as const;
export const DILUENT_GASES = ["N2", "CO2", "He", "Ar"] as const;
export const COMBUSTION_REGIMES = ["Sustained Burn", "Self-Extinguished", "Cool Flame", "No Ignition"] as const;
export const GRAVITY_LEVELS = [
  { value: 0, label: "0 g (microgravity)" },
  { value: 0.16, label: "0.16 g (Lunar)" },
  { value: 0.38, label: "0.38 g (Mars)" },
  { value: 1.0, label: "1.0 g (Earth)" },
] as const;

export type Program = (typeof PROGRAMS)[number];
export type FuelMaterial = (typeof FUEL_MATERIALS)[number];
export type FuelGeometry = (typeof FUEL_GEOMETRIES)[number];
export type DiluentGas = (typeof DILUENT_GASES)[number];
export type CombustionRegime = (typeof COMBUSTION_REGIMES)[number];

/** Escape hatch: arbitrary unmapped columns. */
export type ExtraTelemetry = Record<string, unknown>;

/** schema_v1.json - one test run record. */
export interface TestRun {
  experiment_id: string;
  program: Program;
  fuel_material: FuelMaterial;
  fuel_geometry: FuelGeometry;
  gravity_g: number;
  oxygen_pct: number;
  pressure_kpa: number;
  flow_velocity_cm_s: number;
  diluent_gas: DiluentGas;
  combustion_regime: CombustionRegime;
  spread_or_burn_rate?: number | null;
  peak_radiative_flux_kw_m2?: number | null;
  limiting_oxygen_index_pct?: number | null;
  burn_duration_s?: number | null;
  source_doc_id?: string | null;
  source_page?: number | null;
  extra_telemetry: ExtraTelemetry;
}

// ---------- openapi components ----------
export interface Health {
  status: "ok" | "degraded";
  db: boolean;
  test_runs: number;
  chunks: number;
  llm_provider: string;
  schema_version: string;
  extra_telemetry_keys: string[];
}

/** Contract types fuel_material / diluent_gas as plain strings. */
export interface CabinConfig {
  oxygen_pct: number;
  pressure_kpa: number;
  flow_velocity_cm_s: number;
  gravity_g: number;
  fuel_material: string;
  diluent_gas: string;
}

export interface Preset extends CabinConfig {
  id: string;
  name: string;
  description: string;
}

export interface Contribution {
  feature: string;
  label: string;
  /** Signed risk points; contributions sum to risk_index - baseline_risk. */
  value: number;
}

export type RiskBand = "LOW" | "ELEVATED" | "HIGH" | "CRITICAL";

export interface CabinEvaluation {
  risk_index: number;
  risk_band: RiskBand;
  baseline_risk: number;
  predicted_regime: string;
  estimated_loi_pct: number;
  /** oxygen_pct - estimated_loi_pct */
  oxygen_margin_pct: number;
  contributions: Contribution[];
}

export interface RankWeights {
  similarity: number;
  completeness: number;
  criticality: number;
}

export interface RankRequest {
  config: CabinConfig;
  weights?: Partial<RankWeights>;
  limit?: number;
}

export interface RankedExperiment {
  rank: number;
  experiment_id: string;
  total_score: number;
  similarity: number;
  completeness: number;
  criticality: number;
  record: TestRun;
}

export interface RankResponse {
  weights: RankWeights;
  results: RankedExperiment[];
}

export interface Telemetry {
  experiment_id: string;
  time_s: number[];
  flame_radius_mm: number[];
  d_squared_mm2: number[] | null;
  radiative_heat_flux_kw_m2: number[];
  flame_temp_k: number[];
}

export interface AskRequest {
  question: string;
  scenario?: CabinConfig;
}

export interface Citation {
  /** Inline label, e.g. "[DOC-02 p.3]" or "[EXP-0012]". */
  id: string;
  kind: "doc" | "experiment";
  doc_id: string | null;
  page: number | null;
  experiment_id: string | null;
  snippet: string;
}

export type EvidenceSource = "sql_tool" | "hybrid_retriever" | "scenario_ranker" | (string & {});

export interface Evidence {
  id: string;
  kind: "chunk" | "test_run" | "ranked_run";
  source: EvidenceSource;
  score: number;
  text: string;
  doc_id: string | null;
  page: number | null;
  experiment_id: string | null;
}

export type CopilotRoute = "facts" | "search" | "compare" | "out_of_scope";

export interface AskResponse {
  answer: string;
  route: CopilotRoute;
  /** false when the graph answered "no data". */
  supported: boolean;
  rewrites: number;
  citations: Citation[];
  evidence: Evidence[];
  /** Sentences removed by citation_check. */
  dropped_claims: string[];
  trace_id: string;
}
