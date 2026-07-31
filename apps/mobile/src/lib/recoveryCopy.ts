import { DailyInstance } from "../types/database";

export interface RecoveryCopy {
  headline: string | null;   // null = say nothing statistical
  structuralNote: string | null;
}

interface Occurrence {
  date: string;
  status: string;
}

/**
 * Deterministic recovery copy from a block's recent history.
 *
 * Rules:
 * - 'unaccounted' occurrences are TRANSPARENT: they neither break a run nor
 *   count as a miss. The user told us nothing; that is not failure.
 * - Runs are counted in OCCURRENCES (a 3x/week block missed 3 times is not
 *   "3 days"). Calendar span is computed separately from real dates for the
 *   week-scale copy.
 * - With too little history, say nothing statistical at all.
 */
export function buildRecoveryCopy(
  blockName: string,
  window: Occurrence[],   // newest first, includes today's miss at index 0
  todayDate: string
): RecoveryCopy {
  const tracked = window.filter(
    (r) => r.status === "completed" || r.status === "missed"
  );

  // Not enough signal to make any claim.
  if (tracked.length < 3) {
    return { headline: null, structuralNote: null };
  }

  // Consecutive misses from the top (index 0 is today).
  let missRun = 0;
  for (const r of tracked) {
    if (r.status === "missed") missRun++;
    else break;
  }

  // The run of completions immediately before this miss run.
  let priorStreak = 0;
  for (let i = missRun; i < tracked.length; i++) {
    if (tracked[i].status === "completed") priorStreak++;
    else break;
  }

  // Local-safe date diff — construct from components, never parse ISO.
  const toLocal = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const oldestMissDate = tracked[missRun - 1]?.date ?? todayDate;
  const daysSpan = Math.round(
    (toLocal(todayDate).getTime() - toLocal(oldestMissDate).getTime()) / 86400000
  );

  // A run broke a real streak — lead with the streak, not the miss.
  if (missRun === 1 && priorStreak >= 2) {
    return {
      headline: `${blockName} had a ${priorStreak}-day run going.`,
      structuralNote: null,
    };
  }

  // Isolated miss with no streak behind it — say nothing statistical.
  if (missRun === 1) {
    return { headline: null, structuralNote: null };
  }

  // Week-scale gaps: describe in calendar time, which is how people feel it.
  if (daysSpan >= 21) {
    const weeks = Math.floor(daysSpan / 7);
    return {
      headline: `It's been over ${weeks} weeks since ${blockName} landed.`,
      structuralNote: `A block that hasn't landed in this long is usually in the wrong place, not the wrong plan.`,
    };
  }
  if (daysSpan >= 14) {
    return {
      headline: `It's been over two weeks since ${blockName} landed.`,
      structuralNote: `A block that hasn't landed in this long is usually in the wrong place, not the wrong plan.`,
    };
  }
  if (daysSpan >= 7) {
    return {
      headline: `It's been about a week since ${blockName} landed.`,
      structuralNote: `Same slot, same result — worth trying it somewhere else in the day.`,
    };
  }

  // Short run, 2-6 occurrences.
  return {
    headline: `${missRun} in a row on ${blockName}.`,
    structuralNote:
      missRun >= 4
        ? `Same slot, same result — worth trying it somewhere else in the day.`
        : null,
  };
}
