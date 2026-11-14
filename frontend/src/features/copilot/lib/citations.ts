import type { Citation } from "@/lib/api/types";

export type AnswerToken =
  { type: "text"; value: string } | { type: "cite"; value: string };

/**
 * Inline citation tags produced by the backend's citation_check: "[DOC-02 p.3]" (document + page) and
 * "[EXP-0012]" (experiment). A bare "[DOC-02]" or "[ISS-BASS-II p.1]" is accepted too.
 */
const CITE_RE = /\[(?:(?:DOC-\d+|ISS-[A-Z0-9-]+)(?:\s+p\.\s?\d+)?|EXP-\d+)\]/g;
const DOC_TAG_RE = /^\[?(DOC-\d+|ISS-[A-Z0-9-]+)(?:\s+p\.\s?(\d+))?\]?$/i;

/** Split an answer into text and citation-tag tokens (in order; empty text tokens are dropped). */
export function tokenize(answer: string): AnswerToken[] {
  const tokens: AnswerToken[] = [];
  let last = 0;
  for (const m of answer.matchAll(CITE_RE)) {
    const start = m.index ?? 0;
    if (start > last)
      tokens.push({ type: "text", value: answer.slice(last, start) });
    tokens.push({ type: "cite", value: m[0] });
    last = start + m[0].length;
  }
  if (last < answer.length)
    tokens.push({ type: "text", value: answer.slice(last) });
  return tokens;
}

/** "[DOC-01  p. 1]" and "[DOC-01 p.1]" compare equal. */
const normalize = (tag: string) => tag.replace(/\s+/g, "").toUpperCase();

/** The citation a tag refers to: exact id first, then whitespace/case-insensitive. */
export function findCitation(
  tag: string,
  citations: readonly Citation[] | undefined,
): Citation | undefined {
  if (!citations?.length) return undefined;
  return (
    citations.find((c) => c.id === tag) ??
    citations.find((c) => c.id && normalize(c.id) === normalize(tag))
  );
}

/** Chip label without brackets: "DOC-01 p.1", "EXP-0023". */
export const tagLabel = (tag: string) =>
  tag.replace(/^\[|\]$/g, "").replace(/\s+/g, " ");

/** Parse doc_id and optional page number from a tag like "[DOC-03 p.2]" or "DOC-03 p.2". */
export function parseDocTag(
  tag: string,
): { docId: string; page?: number } | null {
  const m = DOC_TAG_RE.exec(tag.trim());
  if (!m?.[1]) return null;
  const docId = m[1].toUpperCase();
  const page = m[2] ? Number.parseInt(m[2], 10) : undefined;
  return { docId, page: Number.isFinite(page) ? page : undefined };
}
