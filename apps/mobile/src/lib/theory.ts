import { formatDisplayDate, getLocalDateString } from "./time";

export interface TheoryLine {
  kind: string;
  rank: number;
  disputed_at?: string | null;
  generated_at?: string | null;
}

/** Device-local calendar day of the current set, or null. */
export function theoryAsOfDate(rows: { generated_at?: string | null }[]): string | null {
  const stamp = rows.find((row) => row.generated_at)?.generated_at;
  if (!stamp) return null;
  const when = new Date(stamp);
  if (Number.isNaN(when.getTime())) return null;
  return formatDisplayDate(getLocalDateString(when));
}

/** Strengths first, then the check-engine finding, then watch, then slip. */
export const THEORY_SECTION_ORDER = [
  "strength",
  "structural",
  "pattern",
  "causal",
] as const;

export type TheorySectionKind = (typeof THEORY_SECTION_ORDER)[number];

export const THEORY_SECTION_COPY: Record<
  TheorySectionKind,
  { title: string; hint: string }
> = {
  strength: { title: "What's holding", hint: "Still true" },
  structural: { title: "Check engine", hint: "The day hangs on this" },
  pattern: { title: "Worth watching", hint: "Showing up, not settled" },
  causal: { title: "What's slipping", hint: "A sequence that keeps repeating" },
};

/** Strengths open the set. Disputed lines are already gone. */
export function visibleTheoryLines<T extends TheoryLine>(rows: T[]): T[] {
  return rows
    .filter((row) => !row.disputed_at)
    .sort((a, b) => {
      const aStrength = a.kind === "strength" ? 0 : 1;
      const bStrength = b.kind === "strength" ? 0 : 1;
      if (aStrength !== bStrength) return aStrength - bStrength;
      return a.rank - b.rank;
    });
}

export function groupTheoryLines<T extends TheoryLine>(
  rows: T[]
): { kind: TheorySectionKind; lines: T[] }[] {
  const visible = visibleTheoryLines(rows);
  return THEORY_SECTION_ORDER.map((kind) => ({
    kind,
    lines: visible.filter((row) => row.kind === kind),
  })).filter((section) => section.lines.length > 0);
}
