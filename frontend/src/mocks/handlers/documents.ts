import { http, HttpResponse } from "msw";
import type { DocumentDetail, DocumentSummary } from "@/lib/api/types";
import { respond } from "../scenarios";

const MOCK_DOCS: DocumentDetail[] = [
  {
    doc_id: "DOC-01",
    title:
      "Flame Spread over Thin Solids in Opposed and Concurrent Low-Speed Flow (BASS-II proxy summary)",
    source_type: "ntrs",
    investigation: "BASS-II",
    url: "https://psi.nasa.gov/physci/repo/search?q=BASS-II",
    sources: [
      "https://psi.nasa.gov/physci/repo/search?q=BASS-II",
      "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/",
      "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/",
    ],
    page_count: 3,
    related_experiment_ids: ["EXP-0001", "EXP-0002", "EXP-0003"],
    pages: [
      {
        page: 1,
        sections: [
          {
            section: "Abstract",
            text: "The Burning and Suppression of Solids II (BASS-II) investigation studied flames spreading over thin and thick solid samples aboard the International Space Station inside the Microgravity Science Glovebox.",
          },
          {
            section: "Key finding: the ventilation paradox",
            text: "Adding a weak forced flow of roughly 5-10 cm/s brought in fresh oxygen without the large convective heat losses of buoyant flow on Earth, lowering the limiting oxygen index (LOI) below both quiescent 0g and 1g values.",
          },
        ],
      },
      {
        page: 2,
        sections: [
          {
            section: "Results by material",
            text: "Cotton-fiberglass (SIBAL) sustained burning in 0g at 21 % O2 with only 5 cm/s of flow, with a measured LOI near 17 %. PMMA sheets burned steadily in concurrent flow down to roughly 16.5 % O2. Nomex HT90-40 did not sustain burning at or below 24 % O2.",
          },
        ],
      },
      {
        page: 3,
        sections: [
          {
            section: "Implications for spacecraft fire safety",
            text: "Shut down ventilation immediately as the first fire response to remove the oxygen supply that low-speed flow provides, and screen cabin materials under low-speed microgravity flow rather than 1g upward propagation alone.",
          },
        ],
      },
    ],
  },
  {
    doc_id: "DOC-02",
    title:
      "Material Flammability in Exploration Atmospheres: Elevated O2 at Reduced Pressure (SoFIE proxy summary)",
    source_type: "ntrs",
    investigation: "SoFIE",
    url: "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/",
    sources: [
      "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/",
      "https://psi.nasa.gov/physci/repo/search?q=combustion",
      "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/",
    ],
    page_count: 3,
    related_experiment_ids: ["EXP-0016", "EXP-0029", "EXP-0030"],
    pages: [
      {
        page: 1,
        sections: [
          {
            section: "Background & Key finding",
            text: "Exploration vehicles and habitats consider reduced-pressure, oxygen-enriched cabin atmospheres such as the Artemis-era 34 % O2 at 56.5 kPa (8.2 psia). This atmosphere is substantially more flammable than ISS sea-level air for every tested material except Nomex.",
          },
        ],
      },
      {
        page: 2,
        sections: [
          {
            section: "Results",
            text: "At 34 % O2 / 56.5 kPa, cotton-fiberglass spread rates are roughly 2-3x the 21 % rate, while Nomex burns marginally when low-speed ventilation is present.",
          },
        ],
      },
      {
        page: 3,
        sections: [
          {
            section: "Recommendations",
            text: "Re-qualify fabrics and foams at the target exploration O2 mole fraction and pressure, and treat ventilation shutdown as a primary countermeasure.",
          },
        ],
      },
    ],
  },
  {
    doc_id: "DOC-03",
    title:
      "Droplet Combustion, Radiative Extinction and Cool Flames in Microgravity (FLEX proxy summary)",
    source_type: "ntrs",
    investigation: "FLEX",
    url: "https://psi.nasa.gov/physci/repo/search?q=FLEX",
    sources: [
      "https://psi.nasa.gov/physci/repo/search?q=FLEX",
      "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/",
      "https://www.youtube.com/watch?v=W1oXykoz9zg",
    ],
    page_count: 3,
    related_experiment_ids: ["EXP-0031", "EXP-0035"],
    pages: [
      {
        page: 1,
        sections: [
          {
            section: "Background & The d-squared law",
            text: "In microgravity a free-floating fuel droplet burns with a spherically symmetric flame that stands off at 4-12 droplet diameters. FLEX ignited n-heptane and methanol droplets in oxygen with nitrogen, carbon dioxide or helium diluent.",
          },
        ],
      },
      {
        page: 2,
        sections: [
          {
            section: "Key finding: cool flames",
            text: "Large n-heptane droplets often showed radiative extinction of the visible hot flame (1500-1800 K) followed by sustained invisible low-temperature cool-flame chemistry at 500-800 K producing carbon monoxide and formaldehyde.",
          },
        ],
      },
      {
        page: 3,
        sections: [
          {
            section: "Implications for spacecraft fire safety",
            text: "Optical flame detectors can miss cool flames; CO and aldehyde gas detection is needed to confirm that a fuel spill fire is truly out.",
          },
        ],
      },
    ],
  },
  {
    doc_id: "DOC-04",
    title:
      "Spherical Gaseous Diffusion Flames, Soot and Extinction Limits (ACME proxy summary)",
    source_type: "ntrs",
    investigation: "ACME",
    url: "https://psi.nasa.gov/physci/repo/search?q=ACME",
    sources: [
      "https://psi.nasa.gov/physci/repo/search?q=ACME",
      "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/",
      "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/",
    ],
    page_count: 2,
    related_experiment_ids: ["EXP-0043", "EXP-0044", "EXP-0050"],
    pages: [
      {
        page: 1,
        sections: [
          {
            section: "Background & Key findings",
            text: "ACME studied laminar, non-premixed gaseous flames from spherical porous burners and coflow burners in the ISS Combustion Integrated Rack. Microgravity diffusion flames were larger, dimmer, and longer-lasting than 1g flames, and could reach radiative extinction when soot radiated heat from the large flame volume.",
          },
        ],
      },
      {
        page: 2,
        sections: [
          {
            section: "Pressure, diluent effects & spacecraft fire safety",
            text: "Lowering pressure from 101.3 to 60 kPa reduced soot and raised LOI slightly. Argon diluent made flames hotter; CO2 suppressed them. Smoke detectors tuned to 1g soot particles may respond differently to low-soot blue microgravity flames that emit ultrafine particles.",
          },
        ],
      },
    ],
  },
  {
    doc_id: "DOC-05",
    title:
      "Partial Gravity (Lunar / Mars) Flammability and Implications for NASA-STD-6001B Material Screening",
    source_type: "ntrs",
    investigation: "SoFIE",
    url: "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/",
    sources: [
      "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/",
      "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/",
      "https://psi.nasa.gov/physci/repo/search?q=combustion",
    ],
    page_count: 3,
    related_experiment_ids: ["EXP-0020", "EXP-0025"],
    pages: [
      {
        page: 1,
        sections: [
          {
            section: "Background & Buoyant flow in partial gravity",
            text: "NASA-STD-6001B Test 1 (Upward Flame Propagation) screens spacecraft materials in normal 1g gravity. At Lunar gravity (0.16g) and 56.5 kPa, buoyant velocity is ~9 cm/s—right in the low-speed ventilation range where microgravity experiments found the lowest limiting oxygen index.",
          },
        ],
      },
      {
        page: 2,
        sections: [
          {
            section: "Findings & Effective velocity concept",
            text: "Thin fabrics in Lunar (0.16g) profiles had LOI values 0.5-1.5 percentage points below their 1g value, especially in the Artemis 34 % O2 / 56.5 kPa atmosphere. Mars (0.38g) behaved closer to 1g.",
          },
        ],
      },
      {
        page: 3,
        sections: [
          {
            section: "Implications for material selection and compliance",
            text: "Lunar and Mars habitats should keep at least a 2-3 percentage point margin between cabin O2 mole fraction and partial-gravity LOI under NASA-STD-6001B Maximum Oxygen Concentration (MOC) testing.",
          },
        ],
      },
    ],
  },
  {
    doc_id: "DOC-06",
    title:
      "A Researcher's Guide to ISS Combustion Science & Physical Sciences Informatics (PSI) Investigations",
    source_type: "ntrs",
    investigation: "ACME",
    url: "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/",
    sources: [
      "https://psi.nasa.gov/physci/repo/search?q=combustion",
      "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/",
      "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/",
      "https://www.youtube.com/watch?v=W1oXykoz9zg",
    ],
    page_count: 3,
    related_experiment_ids: [],
    pages: [
      {
        page: 1,
        sections: [
          {
            section: "Experimental facilities aboard the ISS",
            text: "The Combustion Integrated Rack (CIR) in Destiny houses a 100-litre combustion chamber supporting the Multi-user Droplet Combustion Apparatus (MDCA) for FLEX/CFI and gaseous/solid inserts for ACME and SoFIE. The Microgravity Science Glovebox (MSG) hosted SPICE, BASS, BASS-II, and SLICE.",
          },
        ],
      },
      {
        page: 2,
        sections: [
          {
            section: "PSI investigations: materials flammability, droplets, and gaseous flames",
            text: "Catalogs BASS/BASS-II, Saffire-I/II/III large-scale Cygnus fire safety demonstrations, BRE (Burning Rate Emulator), CFI and CFI-G cool flames, SPICE and SLICE co-flow duct experiments, and E-FIELD Flames partial-gravity analogs alongside LUCI and FM2.",
          },
        ],
      },
      {
        page: 3,
        sections: [
          {
            section: "Fire detection and exploration atmosphere benchmarks",
            text: "SAME, SAME-R, DAFT, and DAFT-2 characterized microgravity smoke particle-size distributions from overheated Teflon, Kapton, silicone, cotton, and paper. Benchmarks include ISS Cabin (21 % O2, 101.3 kPa), Artemis Exploration (34 % O2, 56.5 kPa), and EVA Spacesuits (100 % O2, 29.6 kPa).",
          },
        ],
      },
    ],
  },
  {
    doc_id: "DOC-07",
    title:
      "Historical Spacecraft Fire Incidents and Lessons Learned: Apollo 1, Apollo 13, and Space Station Mir",
    source_type: "ntrs",
    investigation: "SoFIE",
    url: "https://sma.nasa.gov/sma-disciplines/accllp/apollo-1",
    sources: [
      "https://sma.nasa.gov/sma-disciplines/accllp/apollo-1",
      "https://sma.nasa.gov/sma-disciplines/accllp/apollo-13",
      "https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/",
    ],
    page_count: 3,
    related_experiment_ids: [],
    pages: [
      {
        page: 1,
        sections: [
          {
            section: "Apollo 1 (AS-204, January 27, 1967)",
            text: "During a plugs-out test at 16.7 psia (115.1 kPa) in 100 % pure oxygen, an electrical arc ignited nylon netting and Velcro across the cabin. Lessons learned led to a 60 % O2 / 40 % N2 launch mixture, outward-opening hatches, and NASA-STD-6001B material screening with Beta cloth and Nomex.",
          },
        ],
      },
      {
        page: 2,
        sections: [
          {
            section: "Apollo 13 (April 13, 1970)",
            text: "Oxygen Tank No. 2 ruptured in translunar flight after 65 V ground heater testing thermally degraded Teflon wire insulation inside supercritical oxygen (~6.2 MPa / 900 psia), which ignited via an electrical arc when the fan circuit was energized.",
          },
        ],
      },
      {
        page: 3,
        sections: [
          {
            section: "Fire Aboard Space Station Mir (February 23, 1997)",
            text: "A Vika (TGK) solid-fuel lithium perchlorate oxygen generator canister ruptured in Kvant-1, projecting an oxygen-fed jet flame and filling Mir with non-buoyant smoke. Confirmed the criticality of immediate ventilation shutdown, module isolation, and SAME/DAFT smoke detection.",
          },
        ],
      },
    ],
  },
  {
    doc_id: "DOC-08",
    title:
      "NASA Combustion and Spacesuit Spinoffs for Terrestrial Firefighting: Air Tanks, Smoke Detectors, and Fire Attire",
    source_type: "ntrs",
    investigation: "BASS-II",
    url: "https://spinoff.nasa.gov/node/9582",
    sources: [
      "https://spinoff.nasa.gov/node/9582",
      "https://spinoff.nasa.gov/node/9407",
      "https://spinoff.nasa.gov/node/9918",
    ],
    page_count: 2,
    related_experiment_ids: [],
    pages: [
      {
        page: 1,
        sections: [
          {
            section: "1. Fireman's Air Tanks (Composite SCBA, 1976)",
            text: "NASA Johnson Space Center and Scott Aviation adapted filament-wound composite overwrapped pressure vessel (COPV) technology from Apollo life-support backpacks into aluminum-lined high-pressure SCBA firefighting cylinders ~40 % lighter than steel tanks.",
          },
        ],
      },
      {
        page: 2,
        sections: [
          {
            section: "2. Fire Detector (1978) & 3. New Technology for Fire Attire (Project FIRES, 1982)",
            text: "Skylab/Shuttle incipient fire detector research (informing SAME and DAFT) was commercialized as the Brunswick Incipient Fire Detector to discriminate sub-micron smoke from dust. Post-Apollo 1 non-flammable textiles (PBI, Nomex, Beta cloth) were integrated into modern structural firefighter turnout gear via Project FIRES.",
          },
        ],
      },
    ],
  },
  {
    doc_id: "ISS-ACME",
    title:
      "ISS Investigation: Advanced Combustion via Microgravity Experiments (ACME)",
    source_type: "iss_page",
    investigation: "ACME",
    url: "https://psi.nasa.gov/physci/repo/search?q=ACME",
    sources: [
      "https://psi.nasa.gov/physci/repo/search?q=ACME",
      "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/",
    ],
    page_count: 1,
    related_experiment_ids: [],
    pages: [
      {
        page: 1,
        sections: [
          {
            section: "Advanced Combustion via Microgravity Experiments (ACME)",
            text: "Facility: Combustion Integrated Rack (CIR). Objective: Study non-premixed gaseous flames (spherical burner, coflow, flame design, electric-field effects) at 0g, 18-30 % O2, 60-101.3 kPa to improve combustion efficiency, reduce soot, and characterize fire detection and radiation hazards.",
          },
        ],
      },
    ],
  },
  {
    doc_id: "ISS-BASS-II",
    title:
      "ISS Investigation: Burning and Suppression of Solids - II (BASS-II)",
    source_type: "iss_page",
    investigation: "BASS-II",
    url: "https://psi.nasa.gov/physci/repo/search?q=BASS-II",
    sources: [
      "https://psi.nasa.gov/physci/repo/search?q=BASS-II",
      "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/",
    ],
    page_count: 1,
    related_experiment_ids: [],
    pages: [
      {
        page: 1,
        sections: [
          {
            section: "Burning and Suppression of Solids - II (BASS-II)",
            text: "Facility: Microgravity Science Glovebox (MSG), small flow duct. Objective: Study how solid materials (PMMA, SIBAL cotton-fiberglass, Nomex) ignite, spread flame and extinguish in microgravity under controlled low-speed flows (0-50 cm/s) at 16-24 % O2.",
          },
        ],
      },
    ],
  },
  {
    doc_id: "ISS-FLEX",
    title:
      "ISS Investigation: Flame Extinguishment Experiment (FLEX / FLEX-2)",
    source_type: "iss_page",
    investigation: "FLEX",
    url: "https://psi.nasa.gov/physci/repo/search?q=FLEX",
    sources: [
      "https://psi.nasa.gov/physci/repo/search?q=FLEX",
      "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/",
    ],
    page_count: 1,
    related_experiment_ids: [],
    pages: [
      {
        page: 1,
        sections: [
          {
            section: "Flame Extinguishment Experiment (FLEX / FLEX-2)",
            text: "Facility: Combustion Integrated Rack (CIR), Multi-user Droplet Combustion Apparatus. Objective: Measure how free-floating n-heptane and methanol droplets burn and extinguish, test gaseous suppressants (CO2, He), and investigate low-temperature invisible cool flames.",
          },
        ],
      },
    ],
  },
  {
    doc_id: "ISS-SOFIE",
    title: "ISS Investigation: Solid Fuel Ignition and Extinction (SoFIE)",
    source_type: "iss_page",
    investigation: "SoFIE",
    url: "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/",
    sources: [
      "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/",
      "https://psi.nasa.gov/physci/repo/search?q=combustion",
    ],
    page_count: 1,
    related_experiment_ids: [],
    pages: [
      {
        page: 1,
        sections: [
          {
            section: "Solid Fuel Ignition and Extinction (SoFIE)",
            text: "Facility: Combustion Integrated Rack (CIR) solid-fuel insert. Objective: Measure ignition delay, flame spread and extinction of PMMA, cotton-fiberglass, and Nomex across reduced-pressure, oxygen-enriched exploration atmospheres (e.g., 34 % O2 / 56.5 kPa) for Artemis, Gateway, and Mars vehicles.",
          },
        ],
      },
    ],
  },
];

function matchesQuery(doc: DocumentSummary, q: string): boolean {
  const terms = q
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/)
    .filter(Boolean);
  if (terms.length === 0) return true;
  const parts: string[] = [
    doc.doc_id,
    doc.title,
    doc.source_type,
    doc.investigation ?? "",
    doc.url ?? "",
    ...(doc.sources ?? []),
    ...(doc.related_experiment_ids ?? []),
  ];
  for (const page of doc.pages ?? []) {
    for (const sec of page.sections ?? []) {
      parts.push(sec.section, sec.text);
    }
  }
  const haystack = parts.join(" ").toLowerCase();
  return terms.some((t) => haystack.includes(t));
}

export const documentHandlers = [
  http.get("*/api/documents", ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const filtered = q
      ? MOCK_DOCS.filter((doc) => matchesQuery(doc, q))
      : MOCK_DOCS;
    return respond<DocumentSummary[]>(() => filtered, undefined, request);
  }),

  http.get("*/api/documents/:id", ({ request, params }) => {
    const id = decodeURIComponent(String(params.id));
    const doc = MOCK_DOCS.find((d) => d.doc_id === id);
    if (!doc) {
      return HttpResponse.json(
        {
          error: {
            code: "DOCUMENT_NOT_FOUND",
            message: `No document with id '${id}'`,
            details: { doc_id: id },
          },
        },
        { status: 404 },
      );
    }
    return respond<DocumentDetail>(() => doc, undefined, request);
  }),
];
