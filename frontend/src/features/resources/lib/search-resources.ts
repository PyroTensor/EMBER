import type { DocumentSummary } from "@/lib/api/types";

export type SourceFilter = "all" | "ntrs" | "iss_page";

export interface PageMatchSnippet {
  page: number;
  section: string;
  snippet: string;
  matchCount: number;
}

export interface ResourceSearchResult {
  doc: DocumentSummary;
  score: number;
  matchedTerms: string[];
  matchedFields: string[];
  pageSnippets: PageMatchSnippet[];
}

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  ntrs: "NASA NTRS / PSI Paper",
  iss_page: "ISS Investigation Summary",
  psi_dataset: "NASA PSI Dataset",
};

const LOCAL_PDF_LABELS: Record<string, string> = {
  "/papers/iss_researchers_guide_combustion_science.pdf":
    "ISS Researcher's Guide (PDF)",
  "/papers/nasa_glenn_acme.pdf": "NASA Glenn ACME Dossier (PDF)",
  "/papers/nasa_glenn_bass.pdf": "NASA Glenn BASS / BASS-II (PDF)",
  "/papers/nasa_glenn_daft.pdf": "NASA Glenn DAFT (PDF)",
  "/papers/nasa_glenn_flex.pdf": "NASA Glenn FLEX / FLEX-2 (PDF)",
  "/papers/nasa_glenn_saffire.pdf": "NASA Glenn Saffire I–VI (PDF)",
  "/papers/nasa_glenn_same.pdf": "NASA Glenn SAME / SAME-R (PDF)",
  "/papers/nasa_glenn_slice.pdf": "NASA Glenn SLICE (PDF)",
  "/papers/nasa_glenn_spice.pdf": "NASA Glenn SPICE (PDF)",
};

export function formatSourceLinkLabel(url: string): string {
  if (url.startsWith("/papers/")) {
    return (
      LOCAL_PDF_LABELS[url] ?? url.split("/").pop() ?? "Downloaded NASA PDF"
    );
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/$/, "");
    if (host.includes("psi.nasa.gov")) {
      const q = parsed.searchParams.get("q");
      return q ? `NASA PSI Repository (${q})` : "NASA PSI Repository";
    }
    if (host.includes("spinoff.nasa.gov")) {
      return `NASA Spinoff (${path.split("/").pop() ?? "Article"})`;
    }
    if (host.includes("hdl.handle.net")) {
      return `NTRS Handle (${path.split("/").pop() ?? "Report"})`;
    }
    if (host.includes("sma.nasa.gov")) {
      return `NASA SMA (${path.split("/").pop()?.toUpperCase() ?? "Report"})`;
    }
    if (host.includes("history.nasa.gov")) {
      return `NASA History (${path.split("/").pop() ?? "PDF"})`;
    }
    if (host.includes("youtube.com")) {
      return "NASA ScienceCasts Video";
    }
    const lastSeg = path.split("/").filter(Boolean).pop();
    return lastSeg ? `${host} · ${lastSeg}` : host;
  } catch {
    return url;
  }
}

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "what",
  "when",
  "where",
  "which",
  "why",
  "with",
]);

/** Tokenize a user keyword query into distinct lowercase search terms. */
export function tokenizeKeywords(query: string): string[] {
  const raw =
    query
      .toLowerCase()
      .match(/[a-z0-9_.-]+/g)
      ?.filter(Boolean) ?? [];
  const filtered = raw.filter((t) => !STOPWORDS.has(t));
  const tokens = filtered.length > 0 ? filtered : raw;
  return [...new Set(tokens)];
}

/** Build a short snippet (~200 chars) centered around the first matched term. */
function buildSnippet(
  text: string,
  terms: readonly string[],
  maxLen = 210,
): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;

  const lower = clean.toLowerCase();
  let firstIdx = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
    }
  }

  if (firstIdx === -1 || firstIdx < maxLen / 2) {
    return `${clean.slice(0, maxLen).trimEnd()}…`;
  }

  const start = Math.max(0, firstIdx - 60);
  const end = Math.min(clean.length, start + maxLen);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < clean.length ? "…" : "";
  return `${prefix}${clean.slice(start, end).trim()}${suffix}`;
}

function countOccurrences(haystackLower: string, term: string): number {
  if (!term) return 0;
  let count = 0;
  let pos = 0;
  while (true) {
    const idx = haystackLower.indexOf(term, pos);
    if (idx === -1) break;
    count++;
    pos = idx + term.length;
  }
  return count;
}

/**
 * Filter and rank corpus documents against user-typed keywords.
 * Returns an empty list when the query contains no keywords so no resources are
 * shown until the user types a search query.
 */
export function searchResources(
  docs: readonly DocumentSummary[],
  query: string,
  sourceFilter: SourceFilter = "all",
): ResourceSearchResult[] {
  const pool =
    sourceFilter === "all"
      ? docs
      : docs.filter((d) => d.source_type === sourceFilter);

  const terms = tokenizeKeywords(query);
  const normalizedPhrase = query.trim().toLowerCase();

  if (terms.length === 0) {
    return [];
  }

  const results: ResourceSearchResult[] = [];

  for (const doc of pool) {
    let score = 0;
    const matchedTerms = new Set<string>();
    const matchedFields = new Set<string>();

    const docIdLower = doc.doc_id.toLowerCase();
    const titleLower = doc.title.toLowerCase();
    const invLower = (doc.investigation ?? "").toLowerCase();
    const sourceTypeLower = `${doc.source_type} ${SOURCE_TYPE_LABEL[doc.source_type] ?? ""}`.toLowerCase();
    const sourcesLower = [doc.url ?? "", ...(doc.sources ?? [])]
      .map((u) => `${u} ${formatSourceLinkLabel(u)}`)
      .join(" ")
      .toLowerCase();
    const expIdsLower = (doc.related_experiment_ids ?? [])
      .join(" ")
      .toLowerCase();

    if (normalizedPhrase.length >= 3) {
      if (titleLower.includes(normalizedPhrase)) {
        score += 35;
        matchedFields.add("Title");
      }
      if (docIdLower === normalizedPhrase || invLower === normalizedPhrase) {
        score += 40;
      }
    }

    for (const term of terms) {
      if (docIdLower.includes(term)) {
        score += 25;
        matchedTerms.add(term);
        matchedFields.add("Document ID");
      }
      if (titleLower.includes(term)) {
        score += 20;
        matchedTerms.add(term);
        matchedFields.add("Title");
      }
      if (invLower.includes(term)) {
        score += 18;
        matchedTerms.add(term);
        matchedFields.add("Investigation");
      }
      if (expIdsLower.includes(term)) {
        score += 16;
        matchedTerms.add(term);
        matchedFields.add("Experiment ID");
      }
      if (sourceTypeLower.includes(term)) {
        score += 8;
        matchedTerms.add(term);
        matchedFields.add("Source Type");
      }
      if (sourcesLower.includes(term)) {
        score += 12;
        matchedTerms.add(term);
        matchedFields.add("NASA Link");
      }
    }

    const candidateSnippets: PageMatchSnippet[] = [];

    for (const page of doc.pages ?? []) {
      for (const sec of page.sections ?? []) {
        const secTitleLower = sec.section.toLowerCase();
        const secTextLower = sec.text.toLowerCase();
        let secScore = 0;

        if (
          normalizedPhrase.length >= 3 &&
          (secTitleLower.includes(normalizedPhrase) ||
            secTextLower.includes(normalizedPhrase))
        ) {
          secScore += 18;
        }

        for (const term of terms) {
          const inHeading = countOccurrences(secTitleLower, term);
          const inBody = countOccurrences(secTextLower, term);
          if (inHeading > 0) {
            secScore += 12 * Math.min(inHeading, 2);
            matchedTerms.add(term);
            matchedFields.add(`Page ${page.page}`);
          }
          if (inBody > 0) {
            secScore += 8 * Math.min(inBody, 4);
            matchedTerms.add(term);
            matchedFields.add(`Page ${page.page}`);
          }
        }

        if (secScore > 0) {
          score += secScore;
          candidateSnippets.push({
            page: page.page,
            section: sec.section,
            snippet: buildSnippet(sec.text, terms, 210),
            matchCount: secScore,
          });
        }
      }
    }

    if (score > 0) {
      // Multi-keyword coverage bonus so documents matching all typed keywords rank first
      if (terms.length > 1 && matchedTerms.size === terms.length) {
        score += 30;
      } else if (matchedTerms.size > 1) {
        score += matchedTerms.size * 8;
      }

      candidateSnippets.sort(
        (a, b) => b.matchCount - a.matchCount || a.page - b.page,
      );

      // If matched only metadata (e.g. doc_id or NASA URL) and no body section matched, still include page 1 preview
      const pageSnippets =
        candidateSnippets.length > 0
          ? candidateSnippets.slice(0, 3)
          : doc.pages?.[0]?.sections?.[0]
            ? [
                {
                  page: doc.pages[0].page,
                  section: doc.pages[0].sections[0].section,
                  snippet: buildSnippet(
                    doc.pages[0].sections[0].text,
                    terms,
                    210,
                  ),
                  matchCount: 1,
                },
              ]
            : [];

      results.push({
        doc,
        score,
        matchedTerms: [...matchedTerms],
        matchedFields: [...matchedFields],
        pageSnippets,
      });
    }
  }

  return results.sort(
    (a, b) =>
      b.matchedTerms.length - a.matchedTerms.length ||
      b.score - a.score ||
      a.doc.doc_id.localeCompare(b.doc.doc_id),
  );
}
