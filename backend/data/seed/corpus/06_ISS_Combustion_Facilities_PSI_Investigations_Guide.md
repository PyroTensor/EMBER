---
doc_id: DOC-06
title: "A Researcher's Guide to ISS Combustion Science & Physical Sciences Informatics (PSI) Investigations"
source_type: ntrs
investigation: ACME
fuel: [PMMA, Cotton-Fiberglass, Nomex, Heptane, Methanol]
o2_range: [15, 85]
pressure_kpa: [29.6, 101.3]
gravity: [0.0, 0.16, 0.38]
sources:
  - "https://psi.nasa.gov/physci/repo/search?q=combustion"
  - "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/"
  - "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/"
  - "https://www.youtube.com/watch?v=W1oXykoz9zg"
---
<!-- page: 1 -->
# ISS Combustion Science Facilities and PSI Investigation Catalog

> Compiled from NASA Space Apps 2026 *Flame in Freefall* resources: *PSI Data Repository: Combustion
> Science*, *NASA Glenn Combustion Science*, *A Researcher's Guide to International Space Station
> Combustion Science*, and *NASA ScienceCasts: The Power of Studying Combustion on the ISS*.

## Experimental facilities aboard the ISS

1. **Combustion Integrated Rack (CIR).** Hosted in the U.S. Destiny laboratory module, the CIR provides
   a 100-litre combustion chamber, diagnostic optics, gas-delivery manifolds, and vibration isolation.
   It supports the **Multi-user Droplet Combustion Apparatus (MDCA)** for free-floating liquid fuel
   droplets (FLEX, FLEX-2, CFI) and modular gaseous burner inserts for the **Advanced Combustion via
   Microgravity Experiments (ACME)** suite and the **Solid Fuel Ignition and Extinction (SoFIE)**
   insert.
2. **Microgravity Science Glovebox (MSG).** A sealed containment work volume in Destiny that hosted the
   small fan-driven flow duct originally built for the **Smoke Point In Co-flow Experiment (SPICE)**
   and subsequently used for **Burning and Suppression of Solids (BASS, BASS-II)** and **Structure and
   Liftoff In Combustion Experiment (SLICE)**.

<!-- page: 2 -->
## PSI investigations: materials flammability, droplets, and gaseous flames

- **BASS and BASS-II (Burning and Suppression of Solids).** Tested opposed- and concurrent-flow flame
  spread and extinction over thin sheets, rods, and fabrics (PMMA, SIBAL cotton-fiberglass, Nomex) inside
  the MSG flow duct at 0-50 cm/s ventilation velocity.
- **Saffire-I, Saffire-II, and Saffire-III (Spacecraft Fire Safety Demonstration).** Conducted inside
  uncrewed Cygnus cargo vehicles after ISS departure to study large-scale (up to 1 m long) concurrent
  flame growth, oxygen consumption, and pressure rise over cotton-fiberglass and PMMA samples in realistic
  vehicle volumes.
- **BRE (Burning Rate Emulator, part of ACME).** Uses gaseous fuels (ethylene, methane, propane) fed
  through a flat porous burner in the CIR to emulate the steady regression and heat release of burning
  solid materials (plastic, paper, fabric) without consuming solid samples.
- **CFI and CFI-G (Cool Flames Investigation & Cool Flames Investigation with Gases).** Extended FLEX
  discoveries by sustaining diffusive cool flames (500-800 K) in liquid alkanes and gaseous hydrocarbons
  (such as propane diluted with nitrogen) using a spherical burner with oxygen concentrations up to 85 %.
- **SPICE and SLICE.** SPICE determined the laminar soot point of jet diffusion flames in microgravity
  co-flow; SLICE examined flame liftoff, stabilization, and blowout structure in enclosed co-flow ducts.
- **E-FIELD Flames (Electric-Field Effects on Laminar Diffusion Flames).** Applied high-voltage electric
  fields across laminar gaseous diffusion flames in the CIR so ion-driven body forces mimicked buoyant
  convection, providing an experimental analog for partial-gravity (Lunar 0.16g and Martian 0.38g)
  combustion while direct partial-gravity datasets (**LUCI** - Lunar-g Combustion Investigation, and
  **FM2** - Flammability of Materials on the Moon) are developed.

<!-- page: 3 -->
## Fire detection and exploration atmosphere benchmarks

- **SAME, SAME-R, DAFT, and DAFT-2 (Smoke and Aerosol Measurement Experiment / Dust and Aerosol
  Measurement Feasibility Test).** Characterized the particle-size distribution and morphology of
  microgravity smoke from overheated spacecraft materials (Teflon, Kapton, silicone, cotton, paper)
  versus ambient cabin dust. Microgravity smoke shifts toward smaller primary particles with different
  aggregation rates because residence times in the non-buoyant thermal plume differ from 1g fires.
- **Spacecraft and spacesuit atmosphere benchmarks.**
  - **ISS Standard Cabin:** 21 % O2 at 101.3 kPa (14.7 psia).
  - **Lunar Base / Pressurized Rovers:** Pressure <= 70.3 kPa (10.2 psia) with O2 >= 30 % (an increase
    of more than 40 % in oxygen concentration relative to Earth air, substantially lowering material LOI
    margins).
  - **Artemis Exploration Atmosphere:** 34 % O2 at 56.5 kPa (8.2 psia).
  - **Extravehicular Activity (EVA) Spacesuits:** 100 % O2 at 29.6 kPa (4.3 psia), eliminating nitrogen
    decompression sickness risk while requiring strict ignition-source and material flammability controls.
