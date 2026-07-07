import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { generateDailyInstances, supabase } from "../lib/supabase";
import { scheduleTodayBlockNotifications } from "../lib/blockNotifications";
import { fetchTodayStats, TodayStats } from "../lib/stats";
import { getLocalDateString } from "../lib/time";
import { handleError } from "../lib/errors";
import { AdhocTask } from "../types/database";
import { useStore } from "../store";

export function useTodayData(userId: string | undefined) {
  const { todayInstances, setTodayInstances } = useStore();
  const [loading, setLoading] = useState(true);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [displayDate, setDisplayDate] = useState(getLocalDateString());
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [adhocTasks, setAdhocTasks] = useState<AdhocTask[]>([]);
  const currentDateRef = useRef(getLocalDateString());

  const timedAdhoc = useMemo(
    () => adhocTasks.filter((t) => t.start_minutes != null),
    [adhocTasks]
  );

  const anytimeAdhoc = useMemo(
    () => adhocTasks.filter((t) => t.start_minutes == null),
    [adhocTasks]
  );

  const updateAdhocTask = useCallback((id: string, patch: Partial<AdhocTask>) => {
    setAdhocTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

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

      const { data: adhoc, error: adhocError } = await supabase
        .from("adhoc_tasks")
        .select("*")
        .eq("user_id", userId)
        .eq("date", targetDate)
        .neq("status", "removed")
        .order("start_minutes", { nullsFirst: false });

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

      if (adhocError) {
        handleError(adhocError, "loadToday adhoc");
      } else {
        setAdhocTasks(adhoc ?? []);
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

      const { error: genError } = await supabase.rpc("generate_my_daily_instances", {
        target_date: targetDate,
      });
      if (genError) throw genError;

      await loadToday();
    } catch (err) {
      await loadToday().catch(() => {});
      handleError(err, "resetToday", "Couldn't reset today's schedule — please try again");
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
    adhocTasks,
    timedAdhoc,
    anytimeAdhoc,
    updateAdhocTask,
  };
}
