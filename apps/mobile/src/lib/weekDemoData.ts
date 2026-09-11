export type DemoDay = { o: number[] };

export const DEMO_BLOCKS = ["Deep work morning", "Deep work afternoon"];

/** Morning is the earlier block. The live pack computes both signs of
 *  ordered pairs; this demo is the keystone sign — earlier failing,
 *  later failing. Overrun is unavailable: actual_end_minutes is captured
 *  but read by nothing, and the pack forbids claiming a block "ran until"
 *  a time. */
export const MORNING_INDEX = 0;
export const AFTERNOON_INDEX = 1;

export const landed = (d: DemoDay) => d.o[MORNING_INDEX] === 1;

export type DemoFilter = "all" | "landed" | "failed";

// Founder's measured block_coupling row for Deep work morning → Deep work
// afternoon on the engine's 30-day window. 26 days (the pair's `days`
// count): 11 morning-landed with 1 afternoon miss, 15 morning-failed with
// 10 afternoon misses, 11 of 26 overall (42%). The day order visualizes
// that 2×2, not a reconstructed calendar. Update these cells together
// with any copy that quotes the counts (onboarding reveal, docs/index.html).
export const DEMO_DAYS: DemoDay[] = [
  { o: [1, 1] },
  { o: [0, 0] },
  { o: [1, 1] },
  { o: [0, 0] },
  { o: [1, 1] },
  { o: [0, 1] },
  { o: [0, 0] },
  { o: [1, 1] },
  { o: [0, 0] },
  { o: [1, 1] },
  { o: [0, 1] },
  { o: [1, 0] },
  { o: [0, 0] },
  { o: [1, 1] },
  { o: [0, 0] },
  { o: [1, 1] },
  { o: [0, 1] },
  { o: [0, 0] },
  { o: [1, 1] },
  { o: [0, 0] },
  { o: [1, 1] },
  { o: [0, 1] },
  { o: [0, 0] },
  { o: [1, 1] },
  { o: [0, 0] },
  { o: [0, 1] },
];

export function dayVisible(day: DemoDay, filter: DemoFilter): boolean {
  if (filter === "all") return true;
  return filter === "landed" ? landed(day) : !landed(day);
}

export function demoCounts(filter: DemoFilter = "all"): {
  n: number;
  missed: number;
} {
  let n = 0;
  let missed = 0;
  for (const day of DEMO_DAYS) {
    if (!dayVisible(day, filter)) continue;
    n += 1;
    if (day.o[AFTERNOON_INDEX] === 0) missed += 1;
  }
  return { n, missed };
}
