import { MIN_BLOCK_MINUTES } from "./schedule";

export const REMEDY_WINDOW = 7;
export const REMEDY_MIN_FAILURES = 4;
// A 30-minute block halved is already at the floor. Only offer when
// there is a real bar to lower.
const MIN_DURATION_TO_SHORTEN = 40;

export type RemedyHistoryRow = {
  status: string;
  completion_rating?: string | null;
};

export type ShortenRemedy = {
  kind: "shorten";
  fromMinutes: number;
  toMinutes: number;
};

const RESOLVED = new Set(["completed", "missed", "unaccounted"]);

export function planShortenTemplate(
  durationMinutes: number,
  history: RemedyHistoryRow[]
): ShortenRemedy | null {
  if (durationMinutes < MIN_DURATION_TO_SHORTEN) return null;

  const window = history.filter((r) => RESOLVED.has(r.status)).slice(0, REMEDY_WINDOW);
  if (window.length < REMEDY_WINDOW) return null;

  const failures = window.filter(
    (r) => r.status === "missed" || r.status === "unaccounted"
  ).length;
  const rated = window.filter((r) => r.completion_rating != null);
  const poor = rated.filter(
    (r) =>
      r.completion_rating === "partial" || r.completion_rating === "pulled_away"
  ).length;
  const qualityHit = rated.length >= REMEDY_WINDOW && poor >= REMEDY_MIN_FAILURES;

  if (failures < REMEDY_MIN_FAILURES && !qualityHit) return null;

  const toMinutes = Math.max(
    MIN_BLOCK_MINUTES,
    Math.round(durationMinutes / 2)
  );
  if (toMinutes >= durationMinutes) return null;

  return { kind: "shorten", fromMinutes: durationMinutes, toMinutes };
}
