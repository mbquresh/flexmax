import { supabase } from "./supabase";
import { getLocalDateString } from "./time";

export interface TodayStats {
  streak: number;
  completionRate: number; // 0-100
  completedCount: number;
  totalCount: number;
  weekDayAccounted: boolean[]; // Mon–Sun, index 0 = Monday
}

function toLocalDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

// A block is "accounted for" when the user gave it a real status.
// 'unaccounted' (swept by migration 012 — never acknowledged) and
// 'pending'/'active' (not yet answered) are NOT accounted.
// 'removed' and 'rescheduled' are excluded from the ledger entirely —
// they are not part of that day's commitments.
const ACCOUNTED = ["completed", "missed", "skipped"];
const EXCLUDED = ["removed", "rescheduled"];

export async function fetchTodayStats(userId: string): Promise<TodayStats> {
  const today = getLocalDateString();

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

  const total =
    weekInstances?.filter(
      (i) =>
        i.status !== "skipped" &&
        i.status !== "rescheduled" &&
        i.status !== "removed"
    ).length ?? 0;

  const completed =
    weekInstances?.filter((i) => i.status === "completed").length ?? 0;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const byDate = new Map<string, { relevant: number; accounted: number }>();
  for (const r of windowRows ?? []) {
    if (EXCLUDED.includes(r.status)) continue;
    const entry = byDate.get(r.date) ?? { relevant: 0, accounted: 0 };
    entry.relevant++;
    if (ACCOUNTED.includes(r.status)) entry.accounted++;
    byDate.set(r.date, entry);
  }

  // A day is closed out when every relevant block has a real status.
  const accountedDates = new Set(
    [...byDate.entries()]
      .filter(([, v]) => v.relevant > 0 && v.accounted === v.relevant)
      .map(([date]) => date)
  );

  // Days with nothing scheduled are transparent — they neither break the
  // streak nor extend it. A user should not lose a streak to an empty day.
  const emptyDates = new Set(
    [...byDate.entries()].filter(([, v]) => v.relevant === 0).map(([d]) => d)
  );

  const weekDayAccounted = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dateStr = toLocalDateStr(day);
    return accountedDates.has(dateStr);
  });

  let streak = 0;
  const checkDate = new Date(now);

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
    completionRate,
    completedCount: completed,
    totalCount: total,
    weekDayAccounted,
  };
}
