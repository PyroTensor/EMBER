---
doc_id: DOC-06
title: "A Researcher's Guide to ISS Combustion Science & Physical Sciences Informatics (PSI) Investigations"
source_type: ntrs
investigation: ACME
fuel: [PMMA, Cotton-Fiberglass, Nomex, Heptane, Methanol]
o2_range: [15, 85]
pressure_kpa: [29.6, 101.3]
gravity: [0.0, 0.16, 0.38]
url: "/papers/iss_researchers_guide_combustion_science.pdf"
sources:
  - "/papers/iss_researchers_guide_combustion_science.pdf"
  - "/papers/nasa_glenn_acme.pdf"
  - "/papers/nasa_glenn_bass.pdf"
  - "/papers/nasa_glenn_flex.pdf"
  - "/papers/nasa_glenn_saffire.pdf"
  - "/papers/nasa_glenn_same.pdf"
  - "/papers/nasa_glenn_daft.pdf"
  - "/papers/nasa_glenn_slice.pdf"
  - "/papers/nasa_glenn_spice.pdf"
  - "https://psi.nasa.gov/physci/repo/search?q=combustion"
  - "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/"
  - "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/"
  - "https://www.youtube.com/watch?v=W1oXykoz9zg"
---
<!-- page: 1 -->
# ISS Combustion Science Facilities and PSI Investigation Catalog

> Extracted from downloaded NASA Space Apps 2026 *Flame in Freefall* resources: *A Researcher's Guide to
> International Space Station Combustion Science* (`NP-2015-10-034-JSC`), *NASA Glenn Combustion Science*
> investigation dossiers (`ACME`, `BASS`, `DAFT`, `FLEX`, `Saffire`, `SAME`, `SLICE`, `SPICE`), and the
> *NASA Physical Sciences Informatics (PSI)* combustion repository (26 indexed investigations).

## Experimental facilities aboard the ISS

1. **Combustion Integrated Rack (CIR).** Launched on STS-126 (November 2008) into the U.S. Destiny
   laboratory module, the CIR provides a 100-litre (~90 L free-volume) constant-volume combustion chamber,
   five optical/UV/multispectral diagnostic cameras (color digital at 1360x1024, LLL-UV at 310 nm for OH*
   chemiluminescence, HiBMs with Liquid-Crystal Tunable Filter for color-ratio pyrometry and soot volume
   fraction), gas chromatograph, thermopile radiometer arrays (0.2-11 um), and SAMS-II microgravity
   accelerometers. It hosts the **Multi-User Droplet Combustion Apparatus (MDCA)** for free-floating liquid
   fuel droplets (FLEX, FLEX-2, FLEX-2J, FLEX-ICE-GA, CFI) and modular chamber inserts for **ACME** and
   **SoFIE**.
2. **Microgravity Science Glovebox (MSG).** A sealed containment work volume in Destiny that hosted the
   small fan-driven co-flow wind tunnel (5-50 cm/s airflow with 0-500 cc/min GN2 nitrogen suppression)
   originally built for **SPICE** (`PSI-107`) and subsequently used for **SLICE** (`PSI-106`), **BASS**
   (41 samples, 89 test points), **BASS-II** (`PSI-25`, 100 samples), **BASS-M** (44 Milliken flame-retardant
   textile samples), and **SAME / SAME-R** (`PSI-101`, `PSI-102`).

<!-- page: 2 -->
## PSI investigations: materials flammability, droplets, and gaseous flames

- **BASS, BASS-II (`PSI-25`), and BASS-M.** Tested opposed- and concurrent-flow flame spread and nitrogen
  suppression over thin sheets, acrylic rods, 1-2 cm PMMA spheres, candles, and SIBAL (75 % cotton / 25 %
  fiberglass) and Milliken treated textiles inside the MSG flow duct at 5-50 cm/s ventilation velocity
  (`PSI-62` FGM concurrent spread modeling).
- **Saffire-I through Saffire-VI (`PSI-98`, `PSI-99`, `PSI-100`).** Conducted inside uncrewed Northrop Grumman
  (Orbital ATK) Cygnus cargo vehicles after ISS departure (1.3 m x 1.0 m x 0.5 m flow duct) to study
  large-scale flame growth over 0.4 m x 1.0 m SIBAL cotton-fiberglass, Nomex, and spacecraft window acrylic
  (PMMA) panels across exploration pressures and O2 concentrations.
- **ACME Suite (6 experiments in CIR).**
  1. **BRE (`PSI-20`, Burning Rate Emulator):** Flat porous gaseous burner (methane, ethylene, propane) with
     surface thermocouple and dual heat-flux transducers simulating condensed-phase burning of paper, plastic,
     and alcohol.
  2. **CLD Flame (`PSI-21`, Coflow Laminar Diffusion Flame):** Investigated soot-inception and dilution
     extinction limits; microgravity soot volume fractions reached 5-8x normal-gravity levels.
  3. **E-FIELD Flames:** Applied up to +-10 kV across a burner and circular electrode mesh (35-50 mm
     downstream) so ion-driven body forces mimicked buoyant convection (partial-gravity analog alongside
     **LUCI**, **FM2** Lunar-g 0.16g tests, and international **FLARE**).
  4. **Flame Design (`PSI-10`):** Normal and inverse spherical diffusion flames characterizing stoichiometric
     mixture fraction soot and extinction limits.
  5. **s-Flame:** Spherical porous burner studying radiative vs. convective extinction (high vs. low
     Damkohler number) and high-Lewis-number pulsating instabilities.
  6. **CFI-G (`PSI-159`) & CFI (`PSI-39`):** Quasi-steady spherical gaseous cool flames and liquid alkane
     (n-heptane, n-dodecane, iso-dodecane at 0.25-5 atm) cool flames (500-800 K, `PSI-117`, `PSI-142`).
- **FLEX, FLEX-2 (`PSI-68`), FLEX-2J (JAXA), and FLEX-ICE-GA (ASI).** Single and binary droplet arrays
  (2-5 mm diameter) of methanol, n-heptane, and biofuel blends (50-50 n-heptane/ethanol and n-hexanol/n-decane)
  with CO2 and He suppressants up to 0.70 mole fraction.
- **SPICE (`PSI-107`, `PSI-60`) and SLICE (`PSI-106`).** SPICE completed 250 microgravity gas-jet tests
  (propylene, propane, ethylene) identifying 70+ laminar smoke points; SLICE characterized attached-to-lifted
  flame base detachment and blowout velocity limits.

<!-- page: 3 -->
## Fire detection and exploration atmosphere benchmarks

- **SAME (`PSI-101`, `PSI-115`), SAME-R (`PSI-102`), and DAFT.** SAME tested 30 pyrolysis smoke samples across
  five spacecraft materials (**Teflon, Kapton, silicone rubber, cellulose, and dibutyl-phthalate / Pyrell**)
  in the MSG using a thermal precipitator (TEM) and moment-method aerosol analyzers, comparing Space Shuttle
  ionization detectors (sensitive to <1 um particles) against ISS near-IR photoelectric forward-scattering
  detectors (most sensitive >1 um). While arithmetic mean diameters were 100-227 nm, particle coagulation in
  microgravity shifted nearly half of silicone smoke mass above 1000 nm. **DAFT** validated the modified
  **P-Trak** ultrafine condensation particle counter (using isopropyl alcohol condensation to grow 0.2-1 um
  particles) on ISS Expeditions 10-13.
- **Spacecraft and spacesuit atmosphere benchmarks.**
  - **ISS Standard Cabin:** 21 % O2 at 101.3 kPa (14.7 psia).
  - **Lunar Base / Pressurized Rovers:** Pressure <= 70.3 kPa (10.2 psia) with O2 >= 30 % (>40 % increase in
    O2 mole fraction relative to Earth air, substantially lowering material LOI margins).
  - **Artemis Exploration Atmosphere:** 34 % O2 at 56.5 kPa (8.2 psia).
  - **Extravehicular Activity (EVA) Spacesuits:** 100 % O2 at 29.6 kPa (4.3 psia).
