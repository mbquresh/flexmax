// Same list DayChips re-exports. Import here rather than from the component
// so this module stays testable without pulling React Native.
import { WEEKDAYS } from "./schedule";
import { getLocalDateString, parseLocalDate } from "./time";

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

export type TimeOverrides = Record<string, { start: number; end: number }>;

export function resolveBlockTimes(
  block: { start_minutes: number; end_minutes: number; time_overrides?: TimeOverrides | null },
  dayOfWeek: number
): { start: number; end: number } {
  const o = block.time_overrides?.[String(dayOfWeek)];
  return o
    ? { start: o.start, end: o.end }
    : { start: block.start_minutes, end: block.end_minutes };
}

export function overrideDays(o?: TimeOverrides | null): number[] {
  return Object.keys(o ?? {}).map(Number).sort((a, b) => a - b);
}

// Both keys move together. A half-override means inheriting one end of a
// window and not the other, which is never what someone means.
export function setOverride(
  o: TimeOverrides | null | undefined,
  day: number,
  times: { start: number; end: number } | null
): TimeOverrides {
  const next = { ...(o ?? {}) };
  if (times) next[String(day)] = times;
  else delete next[String(day)];
  return next;
}

// The live column is NOT NULL DEFAULT '{}'. An explicit null is a 23502,
// and because days_of_week rides in the same UPDATE the weekday-only
// choice never lands — the block stays on every day.
export function packedTimeOverrides(
  days: number[],
  o?: TimeOverrides | null,
  base?: { start: number; end: number }
): TimeOverrides {
  const next: TimeOverrides = {};
  for (const [k, v] of Object.entries(o ?? {})) {
    if (!days.includes(Number(k))) continue;
    if (base && v.start === base.start && v.end === base.end) continue;
    next[k] = v;
  }
  return next;
}

export function hasDistinctOverride(
  block: {
    start_minutes: number;
    end_minutes: number;
    time_overrides?: TimeOverrides | null;
  },
  dayOfWeek: number
): boolean {
  const o = block.time_overrides?.[String(dayOfWeek)];
  if (!o) return false;
  return o.start !== block.start_minutes || o.end !== block.end_minutes;
}

export function shiftOverrides(
  o: TimeOverrides | null | undefined,
  deltaStart: number,
  deltaEnd: number
): TimeOverrides {
  if (!deltaStart && !deltaEnd) return { ...(o ?? {}) };
  const next: TimeOverrides = {};
  for (const [k, v] of Object.entries(o ?? {})) {
    const start = v.start + deltaStart;
    const end = v.end + deltaEnd;
    if (start < 0 || end > 1440 || end <= start) continue;
    next[k] = { start, end };
  }
  return next;
}

export function earliestResolvedStart(
  block: {
    start_minutes: number;
    end_minutes: number;
    days_of_week?: number[] | null;
    time_overrides?: TimeOverrides | null;
  }
): number {
  const days = (block.days_of_week ?? []).map(Number);
  if (!days.length) return block.start_minutes;
  return Math.min(...days.map((d) => resolveBlockTimes(block, d).start));
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

export type RecurrenceBlock = {
  days_of_week?: number[] | null;
  starts_on?: string | null;
  ends_on?: string | null;
  interval_weeks?: number | null;
  anchor_date?: string | null;
  created_at?: string | null;
  is_active?: boolean;
};

function utcDayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

// Matches generate_* : weekday, start/end, and interval_weeks against
// anchor_date (then starts_on, then created_at). Away periods and
// block_exceptions are not consulted — those have no move UI, and a
// task on an excepted date is still a valid row.
export function runsOn(block: RecurrenceBlock, dateStr: string): boolean {
  if (block.is_active === false) return false;
  const dow = parseLocalDate(dateStr).getDay();
  if (!(block.days_of_week ?? []).map(Number).includes(dow)) return false;
  if (block.starts_on && dateStr < block.starts_on) return false;
  if (block.ends_on && dateStr > block.ends_on) return false;
  const interval = block.interval_weeks ?? 1;
  if (interval <= 1) return true;
  const anchor =
    block.anchor_date ??
    block.starts_on ??
    block.created_at?.slice(0, 10) ??
    null;
  if (!anchor) return true;
  const weeks = Math.floor((utcDayNumber(dateStr) - utcDayNumber(anchor)) / 7);
  return ((weeks % interval) + interval) % interval === 0;
}

export function upcomingRunDates(
  block: RecurrenceBlock,
  fromDate: string,
  count: number
): string[] {
  const out: string[] = [];
  const start = parseLocalDate(fromDate);
  for (let i = 0; i < 120 && out.length < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = getLocalDateString(d);
    if (runsOn(block, iso)) out.push(iso);
  }
  return out;
}
