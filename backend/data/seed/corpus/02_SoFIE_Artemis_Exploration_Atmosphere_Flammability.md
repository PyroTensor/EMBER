---
doc_id: DOC-02
title: "Material Flammability in Exploration Atmospheres: Elevated O2 at Reduced Pressure (SoFIE proxy summary)"
source_type: ntrs
investigation: SoFIE
fuel: [PMMA, Cotton-Fiberglass, Nomex]
o2_range: [21, 40]
pressure_kpa: [48, 101.3]
gravity: [0.0, 0.16, 0.38, 1.0]
proxy: true
url: "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/"
sources:
  - "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/"
  - "https://psi.nasa.gov/physci/repo/search?q=combustion"
  - "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/"
---
<!-- page: 1 -->
# Material Flammability in Exploration Atmospheres

> PROXY DOCUMENT - written by the EMBER team to resemble NASA PSI / NTRS reporting on the Solid Fuel
> Ignition and Extinction (SoFIE) investigation and on exploration-atmosphere studies. Numbers are
> illustrative and match the EMBER proxy dataset.

## Background

Exploration vehicles and habitats are considering reduced-pressure, oxygen-enriched cabin
atmospheres to shorten pre-breathe time before spacewalks. One example is the Artemis-era 34 % O2 at
56.5 kPa (8.2 psia); another is 26.5 % O2 at 70.3 kPa (10.2 psia). The O2 partial pressure stays close
to sea-level air, so crew physiology is unchanged. The O2 mole fraction, however, rises sharply, and
the mole fraction is what mainly controls material flammability.

## Key finding

Lower pressure on its own slightly raises the limiting oxygen index, because a less dense gas
transfers heat and supplies oxygen less effectively. Across the atmospheres tested this effect was
only about +1 to +2 percentage points, much smaller than the jump from 21 % to 34 % O2. Overall, the
34 % / 56.5 kPa atmosphere is **substantially more flammable** than ISS sea-level air for every tested
material except Nomex.

<!-- page: 2 -->
## Results

| Atmosphere | Cotton-fiberglass | PMMA | Nomex |
|---|---|---|---|
| 21 % / 101.3 kPa | burns in 0g with flow; LOI ~17 % | burns with flow | no ignition |
| 26.5 % / 70.3 kPa | sustained, faster spread | sustained | no ignition |
| 34 % / 56.5 kPa | sustained, spread roughly 2-3x the 21 % rate | sustained | marginal: burns only with ventilation |
| 40 % / 48 kPa | vigorous | vigorous | sustained |

Nomex had a high LOI in microgravity at 56.5 kPa (around 28-29 %), so at 34 % O2 it burned only when
low-speed flow was present. This leaves a margin of only a few percentage points. At 36 % O2 and above,
Nomex burned in every flow condition tested.

## Partial-gravity and 1g comparison

A subset of runs repeated the exploration atmospheres in parabolic-flight Lunar (0.16g) and Mars
(0.38g) profiles and in a ground laboratory (1g). At 0.16g, weak buoyant flow acts like a gentle
ventilation velocity of about 10-12 cm/s, close to the most flammable flow regime. See DOC-05.

<!-- page: 3 -->
## Recommendations

1. **Re-qualify fabrics and foams at the target atmosphere.** Materials should be re-tested at the
   design O2 mole fraction and pressure, not at 21 % / 101.3 kPa. A Nomex garment that passes on ISS
   may be only marginal at 34 %.
2. **Treat ventilation shutdown as a primary countermeasure.** This matters even more in enriched
   atmospheres, because the low-speed flow regime makes flammability worse.
3. **Re-evaluate suppressant concentrations.** Required concentrations should be reconsidered for
   reduced-pressure atmospheres. Fixed-volume CO2 discharges reach lower partial pressures at
   56.5 kPa.

Test runs in the EMBER proxy dataset: SoFIE rows EXP-0016 through EXP-0030.
