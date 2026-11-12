"""Generate EMBER proxy data (Phase 1, pre-Nov 14).

Outputs (all in backend/data/seed/):
  experiments_proxy.csv / .json   50 schema_v1 test runs (BASS-II, SoFIE, FLEX, ACME)
  telemetry_proxy.json            time-series curves per run
  raw_drop_example.csv            deliberately messy "official-looking" file to rehearse the Nov 14 adapter

The numbers are synthetic but seeded with qualitative microgravity-combustion behaviour
reported in NASA PSI / NTRS literature:
  * low-speed forced flow (~5-10 cm/s) in 0g lowers the limiting oxygen index (LOI) below
    the quiescent-0g value (oxygen supply without buoyant heat loss); quiescent 0g raises it
  * lower total pressure raises LOI; enriched O2 (Artemis 34 %) speeds spread
  * FLEX n-heptane droplets show radiative extinction followed by "cool flame" burning
  * CO2 / He diluents suppress more than N2

Run (from backend/):  uv run python scripts/generate_proxy_data.py
"""

from __future__ import annotations

import csv
import json
import math
import random
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
OUT = BACKEND_DIR / "data" / "seed"
SCHEMA = BACKEND_DIR.parent / "contracts" / "schema_v1.json"
SEED = 1114  # Nov 14 :)

MATERIAL_BASE_LOI = {  # rough 1g / 101.3 kPa / buoyant-flow LOI, %
    "PMMA": 17.5,
    "Cotton-Fiberglass": 18.5,
    "Nomex": 27.0,
    "Heptane": 13.5,
    "Methanol": 15.5,
}
DILUENT_SHIFT = {"N2": 0.0, "CO2": 3.0, "He": 2.0, "Ar": -1.0}
PROGRAM_DOC = {"BASS-II": "DOC-01", "SoFIE": "DOC-02", "FLEX": "DOC-03", "ACME": "DOC-04"}


# --------------------------------------------------------------------------- physics-ish model
def buoyant_velocity(g: float, p_kpa: float) -> float:
    """Characteristic buoyant velocity, cm/s (~30 cm/s at 1g, 101.3 kPa)."""
    return 30.0 * math.sqrt(max(g, 0.0) * p_kpa / 101.3)


def effective_velocity(u_forced: float, g: float, p_kpa: float) -> float:
    return math.sqrt(u_forced**2 + buoyant_velocity(g, p_kpa) ** 2)


def loi(material: str, g: float, p_kpa: float, u_forced: float, diluent: str) -> float:
    u = effective_velocity(u_forced, g, p_kpa)
    flow_term = (
        3.0 * math.exp(-u / 3.0) - 1.5 * math.exp(-(((u - 8.0) / 6.0) ** 2)) + 0.05 * max(0.0, u - 30.0)
    )
    pressure_term = 4.0 * (1.0 - p_kpa / 101.3)
    return MATERIAL_BASE_LOI[material] + flow_term + pressure_term + DILUENT_SHIFT[diluent]


def classify(margin: float, geometry: str, g: float, material: str, rng: random.Random) -> str:
    if margin < -2.0:
        return "No Ignition"
    if margin < 0.0:
        return "Self-Extinguished"
    # FLEX: large n-heptane droplets in 0g radiatively extinguish, then keep burning as an invisible
    # cool flame
    if geometry == "Droplet" and material == "Heptane" and g == 0.0 and margin < 9.0 and rng.random() < 0.75:
        return "Cool Flame"
    return "Sustained Burn"


# --------------------------------------------------------------------------- run definitions
def run_specs(rng: random.Random) -> list[dict[str, Any]]:
    specs: list[dict[str, Any]] = []

    # BASS-II: thin solids, 0g, ISS-like atmosphere, sweep of forced flow
    for i in range(15):
        specs.append(
            dict(
                program="BASS-II",
                fuel_material=rng.choice(["PMMA", "PMMA", "Cotton-Fiberglass", "Nomex"]),
                fuel_geometry=rng.choice(["Flat Sheet", "Flat Sheet", "Rod"]),
                gravity_g=0.0,
                oxygen_pct=rng.choice([16.0, 17.0, 18.0, 19.0, 21.0, 21.0, 24.0]),
                pressure_kpa=101.3,
                flow_velocity_cm_s=[0, 1, 2, 3, 5, 5, 7, 8, 10, 12, 15, 20, 25, 35, 50][i],
                diluent_gas="N2",
            )
        )

    # SoFIE: exploration atmospheres (incl. Artemis 34 % / 56.5 kPa) + partial-g analogues + 1g baselines
    sofie_atm = [
        (21.0, 101.3),
        (26.5, 70.3),
        (30.0, 65.0),
        (34.0, 56.5),
        (34.0, 56.5),
        (36.0, 52.0),
        (40.0, 48.0),
    ]
    for i in range(15):
        o2, p = sofie_atm[i % len(sofie_atm)]
        g = [0.0] * 9 + [0.16, 0.16, 0.38, 0.38, 1.0, 1.0]
        specs.append(
            dict(
                program="SoFIE",
                fuel_material=rng.choice(["PMMA", "Cotton-Fiberglass", "Nomex", "Nomex"]),
                fuel_geometry=rng.choice(["Flat Sheet", "Rod"]),
                gravity_g=g[i],
                oxygen_pct=o2,
                pressure_kpa=p,
                flow_velocity_cm_s=rng.choice([0.0, 5.0, 10.0, 20.0]),
                diluent_gas="N2",
            )
        )

    # FLEX: free-floating droplets, 0g, quiescent; diluent sweep -> cool flames
    for i in range(12):
        specs.append(
            dict(
                program="FLEX",
                fuel_material="Heptane" if i < 8 else "Methanol",
                fuel_geometry="Droplet",
                gravity_g=0.0,
                oxygen_pct=rng.choice([15.0, 16.0, 18.0, 21.0, 21.0, 25.0]),
                pressure_kpa=rng.choice([101.3, 101.3, 70.0, 50.0]),
                flow_velocity_cm_s=0.0,
                diluent_gas=rng.choice(["N2", "N2", "CO2", "He"]),
            )
        )

    # ACME: gaseous (pre-vaporised) spherical diffusion flames, 0g, low flow
    for _ in range(8):
        specs.append(
            dict(
                program="ACME",
                fuel_material=rng.choice(["Heptane", "Methanol"]),
                fuel_geometry="Gaseous",
                gravity_g=0.0,
                oxygen_pct=rng.choice([18.0, 21.0, 25.0, 30.0]),
                pressure_kpa=rng.choice([101.3, 80.0, 60.0]),
                flow_velocity_cm_s=rng.choice([0.0, 0.0, 2.0]),
                diluent_gas=rng.choice(["N2", "N2", "CO2", "Ar"]),
            )
        )
    return specs


def build_record(idx: int, spec: dict[str, Any], rng: random.Random) -> dict[str, Any]:
    loi_val = loi(
        spec["fuel_material"],
        spec["gravity_g"],
        spec["pressure_kpa"],
        spec["flow_velocity_cm_s"],
        spec["diluent_gas"],
    )
    loi_val += rng.gauss(0, 0.4)
    margin = spec["oxygen_pct"] - loi_val
    regime = classify(margin, spec["fuel_geometry"], spec["gravity_g"], spec["fuel_material"], rng)

    u_eff = effective_velocity(spec["flow_velocity_cm_s"], spec["gravity_g"], spec["pressure_kpa"])
    is_liquid = spec["fuel_geometry"] in ("Droplet", "Gaseous")

    if regime == "No Ignition":
        rate, flux, duration = 0.0, 0.0, 0.0
    elif is_liquid:
        rate = max(0.05, 0.55 + 0.04 * margin + rng.gauss(0, 0.05))  # K, mm^2/s
        if regime == "Cool Flame":
            rate *= 0.35
        flux = max(0.05, (0.6 if regime == "Cool Flame" else 2.5) + 0.25 * margin + rng.gauss(0, 0.3))
        duration = max(1.0, 12.0 + rng.gauss(0, 3) + (10 if regime == "Cool Flame" else 0))
    else:
        flow_boost = 1.0 + 0.6 * math.exp(-(((u_eff - 8.0) / 8.0) ** 2))
        rate = max(
            0.02,
            (0.18 * margin + 0.1) * flow_boost * (spec["pressure_kpa"] / 101.3) ** 0.3 + rng.gauss(0, 0.05),
        )
        flux = max(0.1, 1.5 + 0.45 * margin + (2.0 if spec["gravity_g"] == 0.0 else 0.0) + rng.gauss(0, 0.5))
        duration = (
            max(2.0, 60.0 + rng.gauss(0, 15))
            if regime == "Sustained Burn"
            else max(1.0, 8.0 + rng.gauss(0, 3))
        )

    if regime == "Self-Extinguished":
        rate *= 0.3
        flux *= 0.5

    extra: dict[str, Any] = {
        "psi_investigation_code": f"PSI-{spec['program']}-{rng.randint(100, 999)}",
        "igniter_power_w": round(rng.uniform(15, 45), 1),
        "missing_channels_count": rng.choice([0, 0, 0, 1, 2]),
    }
    if is_liquid:
        extra["initial_droplet_diameter_mm"] = round(rng.uniform(2.0, 4.5), 2)
        extra["flame_standoff_ratio"] = round(rng.uniform(4.0, 12.0), 1)
    else:
        extra["sample_thickness_mm"] = rng.choice([0.08, 0.18, 1.0, 3.0])
        extra["soot_volume_fraction_ppm"] = round(max(0.0, rng.gauss(1.5, 0.8)), 2)
    if spec["gravity_g"] not in (0.0,):
        extra["facility"] = {
            0.16: "Parabolic flight (Lunar profile)",
            0.38: "Parabolic flight (Mars profile)",
            1.0: "Ground lab",
        }[spec["gravity_g"]]
    if spec["program"] == "ACME":
        extra["fuel_note"] = "pre-vaporised, burner-supported"
    extra["co_co2_molar_ratio"] = round(max(0.0, rng.gauss(0.05, 0.03)), 3)

    # Drop some optional outputs to make completeness scoring meaningful
    rec = dict(
        experiment_id=f"EXP-{idx:04d}",
        **spec,
        combustion_regime=regime,
        spread_or_burn_rate=round(rate, 3),
        peak_radiative_flux_kw_m2=round(flux, 2),
        limiting_oxygen_index_pct=round(loi_val, 2),
        burn_duration_s=round(duration, 1),
        source_doc_id="DOC-05" if spec["gravity_g"] in (0.16, 0.38) else PROGRAM_DOC[spec["program"]],
        source_page=rng.randint(1, 3),
        extra_telemetry=extra,
    )
    if extra["missing_channels_count"] >= 1:
        rec["peak_radiative_flux_kw_m2"] = None
    if extra["missing_channels_count"] >= 2:
        rec["limiting_oxygen_index_pct"] = None
    return rec


def telemetry_for(rec: dict[str, Any], rng: random.Random, n: int = 40) -> dict[str, Any]:
    duration = rec["burn_duration_s"] or 2.0
    t = [round(duration * i / (n - 1), 3) for i in range(n)]
    regime = rec["combustion_regime"]
    is_drop = rec["fuel_geometry"] in ("Droplet", "Gaseous")
    peak_flux = rec["peak_radiative_flux_kw_m2"] or 1.0

    radius, d2, flux, temp = [], [], [], []
    d0 = rec["extra_telemetry"].get("initial_droplet_diameter_mm", 3.0)
    k = rec["spread_or_burn_rate"] or 0.0
    for ti in t:
        f = ti / duration if duration else 0.0
        if regime == "No Ignition":
            radius.append(0.0)
            flux.append(0.0)
            temp.append(300.0)
            if is_drop:
                d2.append(round(d0**2, 3))
            continue
        if is_drop:
            d2v = max(0.0, d0**2 - k * ti)
            d2.append(round(d2v, 3))
            standoff = rec["extra_telemetry"].get("flame_standoff_ratio", 8.0)
            hot = regime != "Cool Flame" or f < 0.3  # cool flames: hot phase then radiative extinction
            r = standoff * math.sqrt(d2v) / 2 * (1.0 if hot else 0.6)
            radius.append(round(r + rng.gauss(0, 0.05), 3))
            temp.append(round((1800 if hot else 650) + rng.gauss(0, 20), 1))
            flux.append(
                round(max(0.0, peak_flux * (math.sin(math.pi * min(f / 0.3, 1.0) / 2) if hot else 0.15)), 3)
            )
        else:
            grow = 1 - math.exp(-5 * f)
            decay = 1.0 if regime == "Sustained Burn" else max(0.0, 1 - f) ** 2
            radius.append(round(25 * grow * decay + rng.gauss(0, 0.3), 3))
            temp.append(round(300 + 1300 * grow * decay + rng.gauss(0, 15), 1))
            flux.append(round(max(0.0, peak_flux * grow * decay + rng.gauss(0, 0.05)), 3))
    return {
        "experiment_id": rec["experiment_id"],
        "time_s": t,
        "flame_radius_mm": radius,
        "d_squared_mm2": d2 if is_drop else None,
        "radiative_heat_flux_kw_m2": flux,
        "flame_temp_k": temp,
    }


# --------------------------------------------------------------------------- messy Nov-14 rehearsal file
REGIME_ALIASES = {
    "Sustained Burn": ["burned", "BURN", "sustained"],
    "Self-Extinguished": ["extinguished", "EXT", "self-ext"],
    "Cool Flame": ["cool flame", "CF"],
    "No Ignition": ["no ign", "NI"],
}


def write_messy_drop(records: list[dict[str, Any]], rng: random.Random) -> None:
    path = OUT / "raw_drop_example.csv"
    headers = [
        "Run ID",
        "Investigation",
        "Sample",
        "Config",
        "g_level",
        "O2 (frac)",
        "Pressure (psia)",
        "Flow (ft/min)",
        "Diluent",
        "Outcome",
        "Spread/Burn rate",
        "Peak Rad Flux (W/cm2)",
        "Duration [s]",
        "Camera_FPS",
        "Crew_Notes",
    ]
    with path.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(headers)
        for r in records[:12]:
            w.writerow(
                [
                    f"NASA-{r['program']}-{r['experiment_id'][-4:]}",
                    r["program"],
                    r["fuel_material"],
                    r["fuel_geometry"],
                    "ug" if r["gravity_g"] == 0.0 else r["gravity_g"],
                    round(r["oxygen_pct"] / 100.0, 4),
                    round(r["pressure_kpa"] / 6.894757, 3),
                    round(r["flow_velocity_cm_s"] / 0.508, 2),
                    r["diluent_gas"],
                    rng.choice(REGIME_ALIASES[r["combustion_regime"]]),
                    r["spread_or_burn_rate"],
                    ""
                    if r["peak_radiative_flux_kw_m2"] is None
                    else round(r["peak_radiative_flux_kw_m2"] / 10.0, 4),
                    r["burn_duration_s"],
                    rng.choice([30, 60, 120]),
                    rng.choice(["", "nominal", "igniter re-fire", "camera glare"]),
                ]
            )


def main() -> None:
    rng = random.Random(SEED)
    OUT.mkdir(parents=True, exist_ok=True)
    records = [build_record(i + 1, s, rng) for i, s in enumerate(run_specs(rng))]

    # validate against the contract
    try:
        import jsonschema

        schema = json.loads(SCHEMA.read_text())
        for r in records:
            jsonschema.validate(r, schema)
        print(f"✓ {len(records)} records validate against schema_v1.json")
    except ImportError:
        print("! jsonschema not installed - skipped validation (run via `uv run`)")

    (OUT / "experiments_proxy.json").write_text(json.dumps(records, indent=2))
    flat_cols = [k for k in records[0] if k != "extra_telemetry"] + ["extra_telemetry"]
    with (OUT / "experiments_proxy.csv").open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=flat_cols)
        w.writeheader()
        for r in records:
            w.writerow({**r, "extra_telemetry": json.dumps(r["extra_telemetry"])})

    telemetry = [telemetry_for(r, rng) for r in records]
    (OUT / "telemetry_proxy.json").write_text(json.dumps(telemetry))
    write_messy_drop(records, rng)

    counts: dict[str, int] = {}
    for r in records:
        counts[r["combustion_regime"]] = counts.get(r["combustion_regime"], 0) + 1
    print("regimes:", counts)
    outputs = "experiments_proxy.(csv|json), telemetry_proxy.json, raw_drop_example.csv"
    print(f"wrote {OUT.relative_to(BACKEND_DIR)}/ {outputs}")


if __name__ == "__main__":
    main()
