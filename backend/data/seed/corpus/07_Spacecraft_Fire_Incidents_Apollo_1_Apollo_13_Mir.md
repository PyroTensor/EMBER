---
doc_id: DOC-07
title: "Historical Spacecraft Fire Incidents and Lessons Learned: Apollo 1, Apollo 13, and Space Station Mir"
source_type: ntrs
investigation: SoFIE
fuel: [Cotton-Fiberglass, Nomex, PMMA]
o2_range: [21, 100]
pressure_kpa: [29.6, 115.1]
gravity: [0.0, 1.0]
sources:
  - "https://sma.nasa.gov/sma-disciplines/accllp/apollo-1"
  - "https://sma.nasa.gov/sma-disciplines/accllp/apollo-13"
  - "https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/"
---
<!-- page: 1 -->
# Historical Spacecraft Fire Incidents: Apollo 1 and Apollo 13

> Compiled from NASA Space Apps 2026 *Flame in Freefall* resources: *NASA Safety and Mission Assurance
> (SMA) Apollo 1*, *NASA SMA Apollo 13*, and *25 Years Ago: Fire Aboard Space Station Mir*.

## Apollo 1 (AS-204, January 27, 1967)

During a "plugs-out" pre-launch countdown test at Launch Complex 34, a cabin fire killed astronauts
Virgil "Gus" Grissom, Edward H. White II, and Roger B. Chaffee.
- **Root conditions.** The Command Module was pressurized to 16.7 psia (115.1 kPa) with **100 % pure
  oxygen**—above sea-level atmospheric pressure—to simulate positive cabin differential pressure.
  Extensive nylon netting, Velcro hook-and-loop fasteners, and polyurethane foam pads were distributed
  across the cabin.
- **Ignition and spread.** An electrical arc in damaged wiring near the Environmental Control Unit
  ignited combustible materials. In 100 % O2 at 16.7 psia, flames spread rapidly across Velcro and nylon
  surfaces, raising cabin pressure until the inner hull ruptured; the inward-opening plug hatch could not
  be opened against the internal pressure.
- **Key fire-safety lessons.**
  1. Replaced 100 % O2 pre-launch cabin pressurization with a **60 % O2 / 40 % N2** mixture at launch,
     transitioning to reduced-pressure oxygen only in orbit.
  2. Established strict spacecraft material flammability screening (the precursor to **NASA-STD-6001B**),
     replacing flammable nylon/Velcro layouts with Beta cloth (Teflon-coated fiberglass) and **Nomex**.
  3. Redesigned the Command Module hatch to open outward in under 5 seconds and insulated electrical
     harnesses against abrasion.

<!-- page: 2 -->
## Apollo 13 (April 13, 1970)

Fifty-six hours into translunar flight, **Oxygen Tank No. 2** in the Service Module ruptured when the
crew energized the tank's internal destratification fan and heater circuits.
- **Combustion mechanism.** During pre-flight detanking at Kennedy Space Center, tank heaters had been
  operated on a 65 V DC ground power supply rather than the spacecraft's 28 V DC bus, fusing the
  thermostatic safety switches closed and raising heater tube temperatures near 800 K (1000 F). This
  thermally degraded the **Teflon electrical wire insulation** inside the tank.
- **Ignition in supercritical oxygen.** When the fan circuit was switched on in flight, an electrical arc
  ignited the damaged Teflon insulation inside supercritical oxygen (~6.2 MPa / 900 psia). Combustion of
  Teflon and aluminum components rapidly over-pressurized the tank dome, blowing off Service Module
  Panel 4 and severing Oxygen Tank No. 1's supply.
- **Key lessons learned.** High-pressure oxygen systems treat even fluoropolymers (Teflon) and metals as
  fuels when exposed to electrical arcing; Apollo 14+ removed internal fan motors from oxygen tanks,
  upgraded thermostat voltage ratings, and added an isolated third oxygen tank.

<!-- page: 3 -->
## Fire Aboard Space Station Mir (February 23, 1997)

With six crew members aboard (Russian cosmonauts, NASA astronaut Jerry Linenger, and ESA astronaut
Reinhold Ewald), a **Vika (TGK)** solid-fuel oxygen generator malfunctioned in the Kvant-1 module.
- **Incident dynamics.** The Vika system generated breathable oxygen via chemical decomposition of a
  **lithium perchlorate** canister. A contaminated canister ruptured and projected a blowtorch-like
  oxygen-fed jet flame (~0.5 m long) with molten metal droplets for roughly 90 seconds to 14 minutes,
  filling the multi-module station with dense smoke.
- **Microgravity fire response challenges.**
  1. **Zero-buoyancy smoke stratification.** Without natural convection, thick smoke did not rise to the
     ceiling; it followed the inter-module ventilation airflow and lingered throughout the cabin for
     hours, requiring crew members to wear portable breathing masks for several hours until filters
     cleared the air.
  2. **Access and suppression.** The fire blocked the transit path to one of the two Soyuz return
     vehicles; water-based foam extinguishers discharged against the oxygen-generating canister were
     unable to suffocate the self-oxidizing lithium perchlorate reaction until the cartridge burned out.
- **ISS design impacts.** Confirmed the criticality of immediate **ventilation shutdown**, independent
  module isolation, redundant escape paths, multi-wavelength smoke/aerosol detectors (informed by
  **SAME** and **DAFT**), and strict containment of solid-fuel oxygen candles.
