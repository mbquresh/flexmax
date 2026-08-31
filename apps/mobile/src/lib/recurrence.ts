// Same list DayChips re-exports. Import here rather than from the component
// so this module stays testable without pulling React Native.
import { WEEKDAYS } from "./schedule";

const WEEKDAY_SET = [1, 2, 3, 4, 5];
const WEEKEND_SET = [0, 6];

function sameSet(a: number[], b: number[]): boolean {
  return a.length === b.length && b.every((d) => a.includes(d));
}

export function describeDays(days: number[]): string {
  if (!days.length) return "Never";
  if (days.length === 7) return "every day";
  if (sameSet(days, WEEKDAY_SET)) return "weekdays";
  if (sameSet(days, WEEKEND_SET)) return "weekends";
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAYS[d].label)
    .join(", ");
}

export function formatEndDate(iso: string): string {
  // Parse as LOCAL. new Date("2026-09-04") is UTC midnight and renders as
  // the previous day in any negative-offset timezone.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function describeRecurrence(
  days: number[],
  intervalWeeks: number,
  endsOn: string | null
): string {
  if (!days.length) return "Never";
  const cadence =
    intervalWeeks === 1 ? "Every week" : `Every ${intervalWeeks} weeks`;
  const base = `${cadence} on ${describeDays(days)}`;
  return endsOn ? `${base} · until ${formatEndDate(endsOn)}` : base;
}
