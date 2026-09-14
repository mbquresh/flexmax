import { formatDisplayDate, getLocalDateString } from "./time";

export interface TheoryLine {
  kind: string;
  rank: number;
  disputed_at?: string | null;
  generated_at?: string | null;
  belief?: string | null;
  nudge_line?: string | null;
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

export type TheoryReportCounts = Record<TheorySectionKind, number>;

/** Undisputed counts in section order. Empty kinds stay 0. */
export function theoryReportCounts<T extends TheoryLine>(
  rows: T[]
): TheoryReportCounts {
  const visible = visibleTheoryLines(rows);
  return {
    strength: visible.filter((row) => row.kind === "strength").length,
    structural: visible.filter((row) => row.kind === "structural").length,
    pattern: visible.filter((row) => row.kind === "pattern").length,
    causal: visible.filter((row) => row.kind === "causal").length,
  };
}

export function theoryReportTotal(counts: TheoryReportCounts): number {
  return THEORY_SECTION_ORDER.reduce((sum, kind) => sum + counts[kind], 0);
}

const SYNOPSIS_MIN = 3;
const SYNOPSIS_MAX = 5;
const SYNOPSIS_SENTENCE_CAP = 180;

function firstSentence(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  let sentence = match ? match[1].trim() : trimmed;
  if (sentence.length > SYNOPSIS_SENTENCE_CAP) {
    const cut = sentence.slice(0, SYNOPSIS_SENTENCE_CAP);
    const space = cut.lastIndexOf(" ");
    sentence = (space > 80 ? cut.slice(0, space) : cut).replace(/[.,;:]+$/, "");
  }
  if (!/[.!?]$/.test(sentence)) sentence += ".";
  return sentence;
}

function lineSynopsis(row: TheoryLine): string | null {
  const raw = row.belief?.trim() || row.nudge_line?.trim();
  if (!raw) return null;
  return firstSentence(raw);
}

/** 3–5 sentences from the current set. Lead of each kind first; fill from the rest. */
export function theoryReportSynopsis<T extends TheoryLine>(rows: T[]): string {
  const visible = visibleTheoryLines(rows);
  const chosen: T[] = [];
  for (const kind of THEORY_SECTION_ORDER) {
    const lead = visible.find((row) => row.kind === kind);
    if (lead) chosen.push(lead);
  }
  if (chosen.length < SYNOPSIS_MIN) {
    for (const row of visible) {
      if (chosen.length >= SYNOPSIS_MIN) break;
      if (!chosen.includes(row)) chosen.push(row);
    }
  }
  if (chosen.length > SYNOPSIS_MAX) chosen.length = SYNOPSIS_MAX;

  return chosen
    .map(lineSynopsis)
    .filter((sentence): sentence is string => !!sentence)
    .join(" ");
}
