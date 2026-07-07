import { supabase } from "./supabase";
import { getLocalDateString } from "./time";

export interface TodayStats {
  streak: number;
  completionRate: number; // 0-100
  completedCount: number;
  totalCount: number;
  weekDayCompletions: boolean[]; // Mon–Sun, index 0 = Monday
}

function toLocalDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

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

  const { data: weekInstances } = await supabase
    .from("daily_schedule_instances")
    .select("date, status")
    .eq("user_id", userId)
    .gte("date", mondayStr)
    .lte("date", sundayStr);

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

  const weekDayCompletions = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dateStr = [
      day.getFullYear(),
      String(day.getMonth() + 1).padStart(2, "0"),
      String(day.getDate()).padStart(2, "0"),
    ].join("-");
    return (
      weekInstances?.some(
        (inst) => inst.date === dateStr && inst.status === "completed"
      ) ?? false
    );
  });

  // ── Streak: consecutive days with at least one completed block ─────────
  // Single query: fetch all completed dates in the last 30 days, compute locally
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const thirtyDaysAgoStr = [
    thirtyDaysAgo.getFullYear(),
    String(thirtyDaysAgo.getMonth() + 1).padStart(2, "0"),
    String(thirtyDaysAgo.getDate()).padStart(2, "0"),
  ].join("-");

  const { data: completedRows } = await supabase
    .from("daily_schedule_instances")
    .select("date")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("date", thirtyDaysAgoStr)
    .order("date", { ascending: false });

  // Distinct set of dates that had at least one completion
  const completedDates = new Set((completedRows ?? []).map((r) => r.date));

  let streak = 0;
  const checkDate = new Date(now);

  for (let i = 0; i < 31; i++) {
    const dateStr = [
      checkDate.getFullYear(),
      String(checkDate.getMonth() + 1).padStart(2, "0"),
      String(checkDate.getDate()).padStart(2, "0"),
    ].join("-");

    if (completedDates.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Today with no completions yet doesn't break the streak
      if (i === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      break;
    }
  }

  return {
    streak,
    completionRate,
    completedCount: completed,
    totalCount: total,
    weekDayCompletions,
  };
}
