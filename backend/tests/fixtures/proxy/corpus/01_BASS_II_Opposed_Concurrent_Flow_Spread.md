---
doc_id: DOC-01
title: "Flame Spread over Thin Solids in Opposed and Concurrent Low-Speed Flow (BASS-II proxy summary)"
source_type: ntrs
investigation: BASS-II
fuel: [PMMA, Cotton-Fiberglass, Nomex]
o2_range: [16, 24]
pressure_kpa: [101.3]
gravity: [0.0]
proxy: true
url: "https://psi.nasa.gov/physci/repo/search?q=BASS-II"
sources:
  - "/papers/nasa_glenn_bass.pdf"
  - "/papers/iss_researchers_guide_combustion_science.pdf"
  - "https://psi.nasa.gov/physci/repo/search?q=BASS-II"
  - "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/"
  - "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/"
---
<!-- page: 1 -->
# Flame Spread over Thin Solids in Opposed and Concurrent Low-Speed Flow

> PROXY DOCUMENT - written by the EMBER team to resemble the structure and qualitative findings of
> NASA PSI / NTRS reports on the Burning and Suppression of Solids (BASS / BASS-II) ISS experiments.
> Numbers are illustrative and match the EMBER proxy dataset, not the official data.

## Abstract

The Burning and Suppression of Solids II (BASS-II) investigation studied flames spreading over thin
and thick solid samples aboard the International Space Station, in a small flow duct inside the
Microgravity Science Glovebox. Forced flow was varied from quiescent (0 cm/s) up to roughly 50 cm/s
at oxygen concentrations from 16 % to 24 % at one atmosphere. Without buoyancy, the only oxidiser
supply to the flame comes from diffusion and from the imposed flow, so the ventilation velocity
controls whether a flame survives.

## Key finding: the ventilation paradox

In quiescent microgravity, flames over thin PMMA and cotton-fiberglass (SIBAL) fabric weakened and
self-extinguished at oxygen levels that support burning on Earth. The combustion products build up
around the flame and the oxygen supply is limited by slow diffusion. Adding a weak forced flow of
roughly 5-10 cm/s - comparable to normal spacecraft cabin ventilation - brought in fresh oxygen
without the large convective heat losses of buoyant flow on Earth. In this low-speed range the
limiting oxygen index (LOI) fell **below** both the quiescent microgravity value and the normal-gravity
value. In practice, a cabin ventilation fan can keep alive a flame that would otherwise go out.

<!-- page: 2 -->
## Results by material

**PMMA (thin sheet, 0.18 mm).** Opposed-flow spread rates peaked near 8-10 cm/s forced flow. At 19 %
O2 and 10 cm/s, spread reached about 1 mm/s; at 0-1 cm/s the same samples did not ignite or quickly
self-extinguished.

**Cotton-fiberglass (SIBAL).** This is a crew-clothing analogue. It sustained burning in 0g at 21 % O2
with only 5 cm/s of flow, with a measured LOI near 17 %, about 1.5 percentage points lower than its
normal-gravity value. Concurrent-flow flames grew longer with time and did not reach a steady length
within the test window.

**Nomex.** Nomex HT90-40 did not sustain burning at or below 24 % O2 at any tested flow velocity. Its
LOI in microgravity at one atmosphere stayed above 25 %. It remains the preferred flame-resistant
fabric for current ISS operations.

## High-speed flows

Above roughly 25-30 cm/s, flames near the extinction limit were blown off, and the LOI rose again.
LOI therefore follows a U-shaped curve against flow velocity, with its minimum at speeds typical of
spacecraft ventilation.

<!-- page: 3 -->
## Implications for spacecraft fire safety

1. **Shut down ventilation immediately.** Cutting cabin ventilation as soon as a fire is detected
   removes the oxygen supply that low-speed flow provides. Without that flow, a weak microgravity
   flame goes back to the starved, quiescent regime. This supports the existing ISS practice of
   shutting off fans as the first fire response.
2. **Earth-based material tests are not always conservative.** The normal-gravity upward
   flammability test (NASA-STD-6001B Test 1) is usually considered conservative. However, thin
   materials in low-speed concurrent flow can burn at oxygen levels slightly below their 1g limit.
   The margin between cabin O2 and a material's LOI should account for this.
3. **Watch for smouldering and re-ignition.** After extinction, samples sometimes smouldered. When
   the flow was restored, a hot ember could re-ignite.

## Data products

Test matrices, spread-rate tables, and video-derived flame-length time series. Test runs in the
EMBER proxy dataset: BASS-II rows EXP-0001 through EXP-0015.
