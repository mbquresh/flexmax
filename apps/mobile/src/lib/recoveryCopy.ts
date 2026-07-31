import { DailyInstance } from "../types/database";

export interface RecoveryCopy {
  headline: string | null;
  structuralNote: string | null;
  lastIntention: { text: string; date: string } | null;
}

interface Occurrence {
  date: string;
  status: string;
}

const toLocal = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Deterministic recovery copy, anchored on when the block last LANDED
 * (status 'completed'), not on consecutive misses.
 *
 * 'unaccounted' means the user never checked in. It is not a failure, but it
 * is also not a landing — so it counts toward the gap without being called a
 * miss. This is what lets a rarely-tracked block still produce honest copy.
 */
export function buildRecoveryCopy(
  blockName: string,
  window: Occurrence[],   // newest first, today's miss at index 0
  todayDate: string,
  lastIntention: { text: string; date: string } | null
): RecoveryCopy {
  if (window.length === 0) {
    return { headline: null, structuralNote: null, lastIntention };
  }

  const lastLandedIdx = window.findIndex((r) => r.status === "completed");
  const notLandedSince = lastLandedIdx === -1 ? window.length : lastLandedIdx;

  // Consecutive completions immediately before the current dry spell.
  let priorStreak = 0;
  if (lastLandedIdx !== -1) {
    for (let i = lastLandedIdx; i < window.length; i++) {
      if (window[i].status === "completed") priorStreak++;
      else break;
    }
  }

  // A real streak just broke — lead with the streak, never the miss.
  if (notLandedSince === 1 && priorStreak >= 2) {
    return {
      headline: `${blockName} had a ${priorStreak}-day run going.`,
      structuralNote: null,
      lastIntention,
    };
  }

  // Calendar span since it last landed. Uses real dates, so a 3x/week block
  // is described in weeks correctly rather than in occurrence counts.
  const daysSince =
    lastLandedIdx === -1
      ? Math.round(
          (toLocal(todayDate).getTime() -
            toLocal(window[window.length - 1].date).getTime()) / 86400000
        )
      : Math.round(
          (toLocal(todayDate).getTime() -
            toLocal(window[lastLandedIdx].date).getTime()) / 86400000
        );

  const slotNote = `Same slot, same result — worth trying it somewhere else in the day.`;
  const placeNote = `A block that hasn't landed in this long is usually in the wrong place, not the wrong plan.`;

  if (daysSince >= 21) {
    const weeks = Math.floor(daysSince / 7);
    return {
      headline: `${blockName} hasn't landed in over ${weeks} weeks.`,
      structuralNote: placeNote,
      lastIntention,
    };
  }
  if (daysSince >= 14) {
    return {
      headline: `${blockName} hasn't landed in over two weeks.`,
      structuralNote: placeNote,
      lastIntention,
    };
  }
  if (daysSince >= 7) {
    return {
      headline: `${blockName} hasn't landed in about a week.`,
      structuralNote: slotNote,
      lastIntention,
    };
  }

  // Under a week.
  if (notLandedSince === 1) {
    return { headline: null, structuralNote: null, lastIntention };
  }
  return {
    headline: `That's ${notLandedSince} tries in a row on ${blockName}.`,
    structuralNote: notLandedSince >= 3 ? slotNote : null,
    lastIntention,
  };
}
