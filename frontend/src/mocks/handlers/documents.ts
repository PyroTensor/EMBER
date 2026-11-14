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
            text: "Cotton-fiberglass (SIBAL) sustained burning in 0g at 21 % O2 with only 5 cm/s of flow, with a measured LOI near 17 %. Nomex HT90-40 did not sustain burning at or below 24 % O2.",
          },
        ],
      },
      {
        page: 3,
        sections: [
          {
            section: "Implications for spacecraft fire safety",
            text: "Shut down ventilation immediately as the first fire response to remove the oxygen supply that low-speed flow provides.",
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
    ],
    page_count: 3,
    related_experiment_ids: ["EXP-0016", "EXP-0029", "EXP-0030"],
    pages: [
      {
        page: 1,
        sections: [
          {
            section: "Background & Key finding",
            text: "The Artemis-era 34 % O2 at 56.5 kPa atmosphere is substantially more flammable than ISS sea-level air for every tested material except Nomex.",
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
    ],
    page_count: 3,
    related_experiment_ids: ["EXP-0031", "EXP-0035"],
    pages: [
      {
        page: 1,
        sections: [
          {
            section: "Background & The d-squared law",
            text: "In microgravity a free-floating fuel droplet burns with a spherically symmetric flame that stands off at 4-12 droplet diameters.",
          },
        ],
      },
      {
        page: 2,
        sections: [
          {
            section: "Key finding: cool flames",
            text: "Large n-heptane droplets often showed radiative extinction of the visible hot flame (1500-1800 K) followed by sustained invisible low-temperature cool-flame chemistry at 500-800 K.",
          },
        ],
      },
      {
        page: 3,
        sections: [
          {
            section: "Implications for spacecraft fire safety",
            text: "Detectors can miss cool flames; CO and aldehyde gas detection is needed to confirm that a fuel spill fire is truly out.",
          },
        ],
      },
    ],
  },
];

export const documentHandlers = [
  http.get("*/api/documents", ({ request }) => {
    const summaries: DocumentSummary[] = MOCK_DOCS.map(
      ({
        doc_id,
        title,
        source_type,
        investigation,
        url,
        sources,
        page_count,
      }) => ({
        doc_id,
        title,
        source_type,
        investigation,
        url,
        sources,
        page_count,
      }),
    );
    return respond<DocumentSummary[]>(() => summaries, undefined, request);
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
