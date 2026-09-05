export interface TheoryLine {
  kind: string;
  rank: number;
  disputed_at?: string | null;
}

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
