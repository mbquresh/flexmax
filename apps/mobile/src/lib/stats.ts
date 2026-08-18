import { supabase } from "./supabase";
import { getLocalDateString } from "./time";

export interface TodayStats {
  streak: number;
  completionRate: number; // 0-100
  completedCount: number;
  totalCount: number;
  todayCompleted: number; // completed instances dated today, as fetched
  todayTotal: number; // relevant instances dated today, as fetched
  weekDayCompletionRatio: number[]; // Mon–Sun, 0–1 completed / relevant (fill height)
  weekDayMissedRatio: number[]; // Mon–Sun, 0–1 missed / relevant (fill height)
  todayCountedInStreak: boolean;
}

export interface StatsRow {
  date: string;
  status: string;
}

function toLocalDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseLocalDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// A block is "accounted for" when the user gave it a real status.
// 'unaccounted' (swept by migration 012 — never acknowledged) and
// 'pending'/'active' (not yet answered) are NOT accounted.
// 'removed' and 'rescheduled' are excluded from the ledger entirely —
// they are not part of that day's commitments.
// skipped: legacy status, no longer writable from the UI.
const ACCOUNTED = ["completed", "missed", "skipped"];
const EXCLUDED = ["removed", "rescheduled"];

// A day counts toward the streak at 80%+ accounted. With ~8 blocks that is
// 7 of 8 — one forgotten block should not erase a day that was otherwise
// closed out honestly, but a real collapse still breaks the streak.
export const STREAK_THRESHOLD = 0.8;

export function computeStreakData(
  windowRows: StatsRow[],
  todayStr: string,
  weekMondayStr: string
): {
  streak: number;
  weekDayCompletionRatio: number[];
  weekDayMissedRatio: number[];
  todayCountedInStreak: boolean;
} {
  const byDate = new Map<
    string,
    { relevant: number; accounted: number; completed: number; missed: number }
  >();
  for (const r of windowRows) {
    if (EXCLUDED.includes(r.status)) continue;
    const entry = byDate.get(r.date) ?? {
      relevant: 0,
      accounted: 0,
      completed: 0,
      missed: 0,
    };
    entry.relevant++;
    if (ACCOUNTED.includes(r.status)) entry.accounted++;
    if (r.status === "completed") entry.completed++;
    if (r.status === "missed") entry.missed++;
    byDate.set(r.date, entry);
  }

  const accountedDates = new Set(
    [...byDate.entries()]
      .filter(([, v]) => v.relevant > 0 && v.accounted / v.relevant >= STREAK_THRESHOLD)
      .map(([date]) => date)
  );

  // Days with nothing scheduled are transparent — they neither break the
  // streak nor extend it. A user should not lose a streak to an empty day.
  const emptyDates = new Set(
    [...byDate.entries()].filter(([, v]) => v.relevant === 0).map(([d]) => d)
  );

  const monday = parseLocalDateStr(weekMondayStr);

  const weekDayCompletionRatio = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dateStr = toLocalDateStr(day);
    const entry = byDate.get(dateStr);
    if (!entry || entry.relevant === 0) return 0;
    return entry.completed / entry.relevant;
  });

  const weekDayMissedRatio = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dateStr = toLocalDateStr(day);
    const entry = byDate.get(dateStr);
    if (!entry || entry.relevant === 0) return 0;
    return entry.missed / entry.relevant;
  });

  let streak = 0;
  const checkDate = parseLocalDateStr(todayStr);

  for (let i = 0; i < 31; i++) {
    const dateStr = toLocalDateStr(checkDate);

    if (i === 0) {
      // Today is still in progress. Count it if already fully closed out,
      // but never let it break the streak.
      if (accountedDates.has(dateStr)) streak++;
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    }

    if (accountedDates.has(dateStr)) {
      streak++;
    } else if (!byDate.has(dateStr) || emptyDates.has(dateStr)) {
      // Nothing was scheduled — transparent, skip without breaking.
    } else {
      break;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return {
    streak,
    weekDayCompletionRatio,
    weekDayMissedRatio,
    todayCountedInStreak: accountedDates.has(todayStr),
  };
}

export async function fetchTodayStats(userId: string): Promise<TodayStats> {
  // ── Completion rate: current week Mon–Sun ──────────────────────────────
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const mondayStr = toLocalDateStr(monday);
  const sundayStr = toLocalDateStr(sunday);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const thirtyDaysAgoStr = toLocalDateStr(thirtyDaysAgo);

  const [{ data: weekInstances }, { data: windowRows }] = await Promise.all([
    supabase
      .from("daily_schedule_instances")
      .select("date, status")
      .eq("user_id", userId)
      .gte("date", mondayStr)
      .lte("date", sundayStr),
    supabase
      .from("daily_schedule_instances")
      .select("date, status")
      .eq("user_id", userId)
      .gte("date", thirtyDaysAgoStr)
      .order("date", { ascending: false }),
  ]);

  const todayStr = toLocalDateStr(now);

  // Only days that have happened. Plan Tomorrow pre-generates tomorrow's
  // instances as 'pending'; counting them would penalize the user for
  // planning ahead.
  const elapsedWeekInstances = (weekInstances ?? []).filter(
    (i) => i.date <= todayStr
  );

  const total = elapsedWeekInstances.filter(
    (i) =>
      // skipped: legacy status, no longer writable from the UI.
      i.status !== "skipped" &&
      i.status !== "rescheduled" &&
      i.status !== "removed"
  ).length;

  const completed = elapsedWeekInstances.filter(
    (i) => i.status === "completed"
  ).length;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const todayInstances = elapsedWeekInstances.filter((i) => i.date === todayStr);
  const todayTotal = todayInstances.filter(
    (i) =>
      // skipped: legacy status, no longer writable from the UI.
      i.status !== "skipped" &&
      i.status !== "rescheduled" &&
      i.status !== "removed"
  ).length;
  const todayCompleted = todayInstances.filter((i) => i.status === "completed").length;

  const { streak, weekDayCompletionRatio, weekDayMissedRatio, todayCountedInStreak } =
    computeStreakData(windowRows ?? [], todayStr, mondayStr);

  return {
    streak,
    completionRate,
    completedCount: completed,
    totalCount: total,
    todayCompleted,
    todayTotal,
    weekDayCompletionRatio,
    weekDayMissedRatio,
    todayCountedInStreak,
  };
}
