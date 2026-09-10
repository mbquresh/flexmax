import { BehavioralInsight } from "../types/database";

/** Cutoff body is the cost of THIS block running over. Strengths and
 *  structural lines are a different claim (a completion record, a
 *  same-day dependency) and read as noise on a mid-block warning. */
export function cutoffNudgeLine(
  insights: BehavioralInsight[],
  currentName: string,
  nextName?: string
): string | null {
  const usable = insights.filter(
    (i) =>
      i.kind !== "strength" &&
      i.kind !== "structural" &&
      !!i.nudge_line &&
      i.related_blocks.includes(currentName)
  );
  if (!usable.length) return null;
  if (nextName) {
    const both = usable.find((i) => i.related_blocks.includes(nextName));
    if (both?.nudge_line) return both.nudge_line;
  }
  return usable[0].nudge_line;
}
