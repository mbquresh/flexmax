export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parse a local YYYY-MM-DD. Never `new Date(str)` — that reads as UTC. */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** "Mon, Aug 17" */
export function formatDayLabel(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return `${WEEKDAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

/** "Aug 17 – 23", or "Aug 31 – Sep 6" across a month boundary. */
export function formatWeekRange(startStr: string, endStr: string): string {
  const a = parseLocalDate(startStr);
  const b = parseLocalDate(endStr);
  const right =
    a.getMonth() === b.getMonth()
      ? `${b.getDate()}`
      : `${MONTH_NAMES[b.getMonth()]} ${b.getDate()}`;
  return `${MONTH_NAMES[a.getMonth()]} ${a.getDate()} – ${right}`;
}

/** A span, not a clock time. 30 -> "30m", 60 -> "1h", 90 -> "1h 30m". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export type TimePeriod = "AM" | "PM";

export function timeToParts(time: string): {
  hour: number;
  minute: number;
  period: TimePeriod;
} {
  const minutes = parseTimeInput(time);
  const h24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period: TimePeriod = h24 < 12 ? "AM" : "PM";
  let hour = h24 % 12;
  if (hour === 0) hour = 12;
  return { hour, minute, period };
}

export function partsToTime(
  hour: number,
  minute: number,
  period: TimePeriod
): string {
  let h = hour;
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return minutesToTime(h * 60 + minute);
}

/** Parse flexible input: 9PM, 9:23 pm, 9:23PM, 21:23 */
export function parseTimeInput(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Pick a time");
  }

  const compact = trimmed.toUpperCase().replace(/\s+/g, "");

  const match24 = compact.match(/^(\d{1,2}):(\d{2})$/);
  if (match24 && !compact.includes("AM") && !compact.includes("PM")) {
    const hours = Number(match24[1]);
    const mins = Number(match24[2]);
    if (hours >= 0 && hours <= 23 && mins >= 0 && mins <= 59) {
      return hours * 60 + mins;
    }
  }

  const match12Compact = compact.match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)$/);
  if (match12Compact) {
    return toMinutes12h(
      Number(match12Compact[1]),
      Number(match12Compact[2] ?? "0"),
      match12Compact[3] as TimePeriod
    );
  }

  const match12Spaced = trimmed
    .toUpperCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (match12Spaced) {
    return toMinutes12h(
      Number(match12Spaced[1]),
      Number(match12Spaced[2] ?? "0"),
      match12Spaced[3] as TimePeriod
    );
  }

  throw new Error(`Couldn't read "${input}". Use hour, minute, and AM/PM.`);
}

function toMinutes12h(
  hour12: number,
  minutes: number,
  period: TimePeriod
): number {
  if (hour12 < 1 || hour12 > 12 || minutes < 0 || minutes > 59) {
    throw new Error("Invalid time");
  }

  let hours = hour12;
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function timeToMinutes(time: string): number {
  return parseTimeInput(time);
}

export function clampHour(value: number): number {
  if (Number.isNaN(value)) return 12;
  return Math.min(12, Math.max(1, Math.round(value)));
}

export function clampMinute(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(59, Math.max(0, Math.round(value)));
}

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTomorrowLocalDateString(): string {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return getLocalDateString(t);
}
