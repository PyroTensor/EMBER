---
doc_id: DOC-07
title: "Historical Spacecraft Fire Incidents and Lessons Learned: Apollo 1, Apollo 13, and Space Station Mir"
source_type: ntrs
investigation: SoFIE
fuel: [Cotton-Fiberglass, Nomex, PMMA]
o2_range: [21, 100]
pressure_kpa: [29.6, 115.1]
gravity: [0.0, 1.0]
url: "https://sma.nasa.gov/sma-disciplines/accllp/apollo-1"
sources:
  - "https://sma.nasa.gov/sma-disciplines/accllp/apollo-1"
  - "https://sma.nasa.gov/sma-disciplines/accllp/apollo-13"
  - "https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/"
  - "https://history.nasa.gov/as204_senate_956.pdf"
  - "https://history.nasa.gov/alsj/a13/A13_MissionReport.pdf"
---
<!-- page: 1 -->
# Historical Spacecraft Fire Incidents: Apollo 1 (AS-204)

> Extracted from NASA Space Apps 2026 *Flame in Freefall* resources: *NASA Safety and Mission Assurance
> (SMA) Apollo 1*, *NASA SMA Apollo 13*, and *25 Years Ago: Fire Aboard Space Station Mir*.

## Apollo 1 (Command Module 012, January 27, 1967)

During a "plugs-out" pre-launch countdown test of Apollo Command Module 012 at Cape Canaveral Launch
Complex 34, a catastrophic cabin fire killed astronauts Virgil "Gus" Grissom, Edward H. White II, and
Roger B. Chaffee.
- **Root conditions.**
  1. The Command Module was pressurized to **16.7 psia (115.1 kPa) with 100 % pure oxygen**—exceeding
     sea-level atmospheric pressure—to simulate positive orbital differential pressure.
  2. Over **3,200 square inches of flammable non-metallic materials** (nylon netting, Velcro hook-and-loop
     fasteners, and polyurethane foam pads) were distributed across the cabin in immediate proximity to
     electrical wiring.
  3. Silver-plated copper wiring insulated with Teflon suffered mechanical abrasion and cold flow over sharp
     metal edges near the Environmental Control System (ECS) instrumentation.
- **Ignition and hull rupture.** An electrical arc near the ECS ignited adjacent combustible nylon and Velcro.
  In 100 % O2 at 16.7 psia, flames spread rapidly across cabin surfaces, raising internal cabin pressure to
  **29-37 psia** until the inner pressure hull ruptured. The inward-opening three-piece plug hatch required at
  least 90 seconds to unlatch and could not be opened against the internal pressure buildup.
- **Key fire-safety redesigns.**
  1. Changed pre-launch pad cabin pressurization to a **60 % O2 / 40 % N2** mixture at 14.7 psia,
     transitioning to reduced-pressure 100 % O2 (5 psia) only in orbit.
  2. Established strict spacecraft material flammability screening (the precursor to **NASA-STD-6001B**),
     replacing flammable nylon/Velcro with Beta cloth (Teflon-coated fiberglass) and **Nomex**.
  3. Redesigned the Command Module hatch into an outward-opening single-piece hatch opening in under 5 seconds
     and armored electrical harnesses with stainless-steel sheathing.

<!-- page: 2 -->
## Apollo 13 (Service Module SM-109, April 13, 1970)

Fifty-six hours into translunar flight toward Fra Mauro, cryogenic **Oxygen Tank No. 2** in Service Module
SM-109 exploded when the crew (Jim Lovell, Jack Swigert, and Fred Haise) energized the tank's internal
destratification fan circuits, crippling the Command Module *Odyssey* and forcing the crew to use the Lunar
Module *Aquarius* as a lifeboat.
- **Thermostatic switch failure and Teflon degradation.** In 1965, the Service Module heater voltage
  specification had been raised from 28 V DC to **65 V DC**, but the thermostatic protective switches on the
  heaters were not upgraded. During a launch-pad detanking procedure at Kennedy Space Center, the switches
  welded shut under 65 V DC, running the heaters continuously for 8 hours at approximately **1000 F (538 C /
  811 K)** and severely degrading the **Teflon electrical wire insulation** on the internal fan motor leads.
- **Ignition in supercritical oxygen.** When the fan circuit was energized in flight, an electrical arc
  ignited the bare/charred Teflon insulation inside supercritical oxygen (~6.2 MPa / 900 psia). Combustion of
  Teflon and aluminum components rapidly over-pressurized the tank dome, blowing off Service Module Sector 4
  panel and severing Oxygen Tank No. 1's supply capability.
- **Remediation and redesigns (Cortright Review Board).** High-pressure oxygen systems treat even
  fluoropolymers (Teflon) and metals as fuels under electrical arcing; Apollo 14+ eliminated internal
  destratification fans and thermostatic switches in favor of external heating loops, sheathed all wiring in
  stainless steel, and added an isolated third cryogenic oxygen tank in Bay 1 of the Service Module.

<!-- page: 3 -->
## Fire Aboard Space Station Mir (February 23/24, 1997)

During crew handover between Mir 22 and Mir 23 (with six crew members aboard: Russian cosmonauts Valeri
Korzun, Aleksandr Kaleri, Vasili Tsibliyev, and Aleksandr Lazutkin, ESA astronaut Reinhold Ewald, and NASA
astronaut Jerry Linenger), a **Vika (TGK)** solid-fuel oxygen generator (SFOG) malfunctioned in the Kvant-1
module.
- **Incident dynamics and root cause.** The Vika system generated breathable oxygen via chemical decomposition
  of a **lithium perchlorate** candle. Post-flight investigation of returned canisters determined that
  hydrocarbon contamination—specifically residue from a **latex working glove** introduced during ground
  assembly—caused the canister to rupture and project a 3-foot (~0.9 m) blowtorch-like oxygen-fed jet flame
  with molten metal droplets for roughly 90 seconds to 14 minutes, filling the multi-module station with dense
  smoke.
- **Microgravity fire response challenges.**
  1. **Zero-buoyancy smoke stratification.** Without natural convection, thick smoke did not rise to a
     ceiling; it followed inter-module ventilation streamlines and lingered throughout the cabin, requiring
     crew members to wear portable breathing masks and respirators for hours until filters cleared the air.
  2. **Egress blockage and suppression.** The fire in Kvant-1 blocked the transit tunnel to one of the two
     docked **Soyuz TM-25** return vehicles; cosmonaut Valeri Korzun (assisted by Linenger and Lazutkin)
     discharged multiple water-based foam extinguishers to cool adjacent structures until the self-oxidizing
     lithium perchlorate reaction burned out.
- **ISS design impacts.** Established dissimilar oxygen-generation redundancy across ISS modules (Russian
  Elektron water-electrolysis units, U.S. Destiny Oxygen Generation System, and strictly quality-controlled
  backup SFOG candles with debris traps and thermal barriers), immediate **ventilation shutdown**, and
  multi-wavelength smoke/aerosol detection informed by **SAME**, **SAME-R**, and **DAFT**.
