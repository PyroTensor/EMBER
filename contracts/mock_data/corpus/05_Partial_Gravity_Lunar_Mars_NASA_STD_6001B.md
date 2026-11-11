---
doc_id: DOC-05
title: "Partial Gravity (Lunar / Mars) Flammability and Implications for NASA-STD-6001B Material Screening"
source_type: ntrs
investigation: SoFIE
fuel: [PMMA, Cotton-Fiberglass, Nomex]
o2_range: [21, 40]
pressure_kpa: [48, 101.3]
gravity: [0.16, 0.38]
proxy: true
---
<!-- page: 1 -->
# Partial Gravity Flammability and NASA-STD-6001B Material Screening

> PROXY DOCUMENT - written by the EMBER team to resemble NASA technical reporting on partial-gravity
> combustion (parabolic flight, centrifuge and modelling studies) and on NASA-STD-6001B material
> flammability testing. Numbers are illustrative.

## Background

NASA-STD-6001B Test 1 (Upward Flame Propagation) is the main pass/fail screen for spacecraft
materials. It is done in normal gravity at the worst-case use atmosphere, and the 1g upward
configuration has long been treated as a conservative worst case. Lunar (0.16g) and Mars (0.38g)
surface habitats bring that assumption back into question.

## Buoyant flow in partial gravity

Buoyancy-induced flow velocity scales roughly with the square root of gravity times pressure. At
0.16g and 56.5 kPa, the characteristic buoyant velocity is about 9 cm/s. This is close to the
low-speed ventilation range where microgravity experiments (DOC-01) found the lowest limiting oxygen
index. Partial-gravity flames can therefore be **more** flammable than both 1g and quiescent 0g
flames.

<!-- page: 2 -->
## Findings

- **Peak flammability at intermediate gravity.** Thin fabrics in parabolic-flight Lunar profiles had
  LOI values 0.5-1.5 percentage points below their 1g value. The effect was strongest in the Artemis
  34 % / 56.5 kPa atmosphere.
- **Mars (0.38g)** behaved more like 1g, with a buoyant velocity of about 15-19 cm/s. Its flammability
  was similar to or slightly above 1g.
- **Adding forced ventilation** to partial-gravity buoyancy can push the effective velocity past the
  flammability peak. This depends on direction and magnitude, so habitat ventilation design changes
  fire behaviour.

## Effective velocity concept

u_eff = sqrt(u_forced^2 + u_buoyant^2) combines forced and buoyant flow into one velocity that
correlates LOI across gravity levels. EMBER's physics module uses this correlation
(data_ml/ember_data/physics/combustion.py).

<!-- page: 3 -->
## Implications for material selection and compliance

1. **Compliance margin.** For Lunar and Mars habitats, materials should keep a margin of at least
   2-3 percentage points between the cabin O2 mole fraction and the material's partial-gravity LOI,
   not just a 1g pass in Test 1.
2. **Maximum Oxygen Concentration (MOC) testing.** The MOC under NASA-STD-6001B Test 1 should be
   determined at the habitat pressure, and adjusted for the partial-gravity LOI reduction.
3. **Operational controls.** Fire response procedures should cut ventilation and isolate the area, as
   on ISS. Lunar dust and EVA suit materials should also be screened.

## Summary table

| Gravity | Buoyant velocity (56.5 kPa) | Flammability vs 1g |
|---|---|---|
| 0g, quiescent | 0 cm/s | lower (starved) |
| 0g, 5-10 cm/s ventilation | 5-10 cm/s | higher |
| 0.16g Lunar | ~9 cm/s | higher (peak) |
| 0.38g Mars | ~15 cm/s | similar / slightly higher |
| 1g | ~22 cm/s | reference |
