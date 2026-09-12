/**
 * Insight refresh cadence. Keep in sync with
 * supabase/functions/_shared/insightCadence.ts
 *
 * Slot days are Mon / Wed / Fri in the user's local calendar. Other days
 * keep the set. A reading older than 7 local days always regenerates.
 */

const SLOT_DAYS = new Set([1, 3, 5]); // Mon, Wed, Fri — Date.getUTCDay()

export function calendarWeekday(localDate: string): number {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

export function isInsightSlotDay(localDate: string): boolean {
  return SLOT_DAYS.has(calendarWeekday(localDate));
}

/** Whole local calendar days from generated_at's UTC date to localDate. */
export function insightAgeDays(generatedAt: string, localDate: string): number {
  const last = generatedAt.slice(0, 10);
  const from = Date.parse(`${last}T00:00:00Z`);
  const to = Date.parse(`${localDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

/** True when the existing set should be returned with no AI call. */
export function insightCacheFresh(
  generatedAt: string,
  localDate: string
): boolean {
  const age = insightAgeDays(generatedAt, localDate);
  if (age >= 7) return false;
  if (age <= 0) return true;
  return !isInsightSlotDay(localDate);
}
