import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { generateDailyInstances, supabase } from "../lib/supabase";
import { scheduleTodayBlockNotifications } from "../lib/blockNotifications";
import { fetchTodayStats, TodayStats } from "../lib/stats";
import { getLocalDateString } from "../lib/time";
import { handleError } from "../lib/errors";
import { useStore } from "../store";

export function useTodayData(userId: string | undefined) {
  const { todayInstances, setTodayInstances } = useStore();
  const [loading, setLoading] = useState(true);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [displayDate, setDisplayDate] = useState(getLocalDateString());
  const [stats, setStats] = useState<TodayStats | null>(null);
  const currentDateRef = useRef(getLocalDateString());

  const loadToday = useCallback(
    async (dateOverride?: string) => {
      if (!userId) return;

      const targetDate = dateOverride ?? getLocalDateString();
      setDisplayDate(targetDate);
      currentDateRef.current = targetDate;
      setLoading(true);

      await generateDailyInstances(targetDate);

      const { count } = await supabase
        .from("schedule_blocks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      setTotalBlocks(count ?? 0);

      const { data, error } = await supabase
        .from("daily_schedule_instances")
        .select("*, block:schedule_blocks(*)")
        .eq("user_id", userId)
        .eq("date", targetDate)
        .neq("status", "removed")
        .order("start_minutes");

      if (error) {
        handleError(error, "loadToday");
      } else {
        setTodayInstances(data ?? []);
        if (data?.length) {
          scheduleTodayBlockNotifications(data, targetDate).catch((err) =>
            handleError(err, "scheduleBlockNotifications")
          );
        }
        fetchTodayStats(userId)
          .then(setStats)
          .catch((err) => handleError(err, "fetchTodayStats"));
      }
      setLoading(false);
    },
    [userId, setTodayInstances]
  );

  useEffect(() => {
    loadToday();
  }, [userId, loadToday]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        const freshDate = getLocalDateString();
        if (freshDate !== currentDateRef.current) {
          currentDateRef.current = freshDate;
          loadToday(freshDate);
        }
      }
    });

    return () => subscription.remove();
  }, [loadToday]);

  const resetToday = useCallback(async () => {
    if (!userId) return;
    const targetDate = getLocalDateString();

    try {
      const { error: delError } = await supabase
        .from("daily_schedule_instances")
        .delete()
        .eq("user_id", userId)
        .eq("date", targetDate);

      if (delError) throw delError;

      await generateDailyInstances(targetDate);

      await loadToday();
    } catch (err) {
      handleError(err, "resetToday", "Could not reset today's schedule");
    }
  }, [userId, loadToday]);

  return {
    instances: todayInstances,
    displayDate,
    totalBlocks,
    stats,
    loading,
    reload: loadToday,
    resetToday,
  };
}
