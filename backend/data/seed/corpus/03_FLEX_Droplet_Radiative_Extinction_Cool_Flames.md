---
doc_id: DOC-03
title: "Droplet Combustion, Radiative Extinction and Cool Flames in Microgravity (FLEX proxy summary)"
source_type: ntrs
investigation: FLEX
fuel: [Heptane, Methanol]
o2_range: [15, 25]
pressure_kpa: [50, 101.3]
gravity: [0.0]
proxy: true
---
<!-- page: 1 -->
# Droplet Combustion, Radiative Extinction and Cool Flames in Microgravity

> PROXY DOCUMENT - written by the EMBER team to resemble NASA PSI / NTRS reporting on the Flame
> Extinguishment Experiment (FLEX / FLEX-2) in the ISS Combustion Integrated Rack. Numbers are
> illustrative and match the EMBER proxy dataset.

## Background

In microgravity a free-floating fuel droplet burns with a spherically symmetric flame. This is the
idealised case of classical droplet theory. FLEX ignited n-heptane and methanol droplets 2-4.5 mm in
diameter in a chamber of oxygen with nitrogen, carbon dioxide or helium diluent. The goals were to
measure burning rates and extinction limits and to evaluate gaseous fire suppressants.

## The d-squared law

During the quasi-steady hot-flame phase, the square of the droplet diameter decreased linearly with
time: d^2(t) = d0^2 - K t. Burning-rate constants K were roughly 0.4-0.9 mm^2/s. The flame stood off
at 4-12 droplet diameters, much farther than on Earth, where buoyancy pushes the flame close to the
droplet. Flame radius and d^2 time-series are provided for each run.

<!-- page: 2 -->
## Key finding: cool flames

Large n-heptane droplets often showed **radiative extinction**: the visible hot flame (around 1500-
1800 K) went out while a large fraction of the droplet was still unburned. Unexpectedly, the droplet
kept vaporising and burning. Combustion continued through **low-temperature "cool flame"
chemistry** at about 500-800 K, which gives off little or no visible light.

Cool flames:
- are essentially invisible to the eye and to standard visible-light cameras;
- give off very little radiant heat (EMBER proxy peak flux below 1 kW/m^2, compared with 2-5 kW/m^2
  for hot flames);
- can last for tens of seconds and keep producing partially oxidised species such as formaldehyde,
  CO and aldehydes;
- can go back to a hot flame if conditions change.

Cool-flame burning was seen most often at 15-21 % O2, in larger droplets, and at reduced pressure.
Methanol droplets did not show the cool-flame regime.

<!-- page: 3 -->
## Diluent effects

At equal O2 mole fraction, CO2 and helium diluents raised the extinction oxygen concentration
compared with nitrogen, by about +3 and +2 percentage points. CO2 adds heat capacity and radiative
loss. Helium increases conductive heat loss. Both are candidates for suppressant atmospheres.

## Implications for spacecraft fire safety

1. **Detectors can miss cool flames.** A fire that looks extinguished on cameras may still be
   reacting. Smoke and gas detection (CO, aldehydes) is needed to confirm that a fuel leak or spill
   fire is actually out.
2. **Hidden re-ignition risk.** A cool flame next to a hot surface or a renewed oxygen supply can go
   back to a hot flame.
3. **Toxic products.** Incomplete low-temperature oxidation produces toxic species even when no
   visible fire is present.

Test runs in the EMBER proxy dataset: FLEX rows EXP-0031 through EXP-0042.
