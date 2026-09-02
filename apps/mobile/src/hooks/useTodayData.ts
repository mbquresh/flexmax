import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { generateDailyInstances, supabase } from "../lib/supabase";
import { scheduleTodayBlockNotifications } from "../lib/blockNotifications";
import { pickPreemptTarget, PreemptCandidate } from "../lib/preempt";
import { fetchTodayStats, TodayStats } from "../lib/stats";
import { getLocalDateString } from "../lib/time";
import { handleError, isConnectivityError } from "../lib/errors";
import { AdhocTask, BehavioralInsight } from "../types/database";
import { useStore } from "../store";

export function useTodayData(userId: string | undefined) {
  const { todayInstances, setTodayInstances, setTodayPreempt, setTodayInsights } = useStore();
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadOffline, setLoadOffline] = useState(false);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [displayDate, setDisplayDate] = useState(getLocalDateString());
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [adhocTasks, setAdhocTasks] = useState<AdhocTask[]>([]);
  const [insights, setInsights] = useState<BehavioralInsight[]>([]);
  const currentDateRef = useRef(getLocalDateString());
  // Every load claims a token. Only the most recent load may write state —
  // an earlier, slower request that resolves last must discard its results.
  const loadSeqRef = useRef(0);

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

  const removeAdhocTask = useCallback((id: string) => {
    setAdhocTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const restoreAdhocTask = useCallback((task: AdhocTask) => {
    setAdhocTasks((prev) =>
      [...prev, task].sort((a, b) => {
        const aStart = a.start_minutes ?? -1;
        const bStart = b.start_minutes ?? -1;
        return aStart - bStart;
      })
    );
  }, []);

  const loadToday = useCallback(
    async (dateOverride?: string, options?: { silent?: boolean }) => {
      if (!userId) return;

      const seq = ++loadSeqRef.current;
      const isStale = () => seq !== loadSeqRef.current;

      const targetDate = dateOverride ?? getLocalDateString();
      setDisplayDate(targetDate);
      currentDateRef.current = targetDate;
      if (!options?.silent) {
        setLoading(true);
        setLoadFailed(false);
      }

      try {
      // Instance generation is idempotent (on conflict do nothing) and the
      // fetch below returns whatever already exists, so a slow or hung
      // generate must not hold the whole screen.
      try {
        await Promise.race([
          generateDailyInstances(targetDate),
          new Promise((resolve) => setTimeout(resolve, 8000)),
        ]);
      } catch (err) {
        handleError(err, "loadToday generate");
      }

      fetchTodayStats(userId)
        .then((s) => {
          if (!isStale()) setStats(s);
        })
        .catch((err) => handleError(err, "fetchTodayStats"));

      const { count } = await supabase
        .from("schedule_blocks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (isStale()) return;
      setTotalBlocks(count ?? 0);

      const { data, error } = await supabase
        .from("daily_schedule_instances")
        .select("*, block:schedule_blocks(*)")
        .eq("user_id", userId)
        .eq("date", targetDate)
        // 'removed' rows are loaded now — the Removed pile needs them, and
        // every consumer downstream (streak, completion rate, notification
        // eligibility, occupiesTime) already filters the status explicitly.
        .order("start_minutes");

      const { data: adhoc, error: adhocError } = await supabase
        .from("adhoc_tasks")
        .select("*")
        .eq("user_id", userId)
        .eq("date", targetDate)
        .neq("status", "removed")
        .order("start_minutes", { nullsFirst: false });

      const { data: insightsData, error: insightsError } = await (
        supabase as typeof supabase & {
          from: (table: "behavioral_insights") => ReturnType<typeof supabase.from>;
        }
      )
        .from("behavioral_insights")
        .select("id, kind, belief, suggestion, related_blocks, rank, generated_at, nudge_line")
        .eq("superseded", false)
        .order("rank") as { data: BehavioralInsight[] | null; error: Error | null };

      if (error) {
        setLoadFailed(true);
        setLoadOffline(isConnectivityError(error));
        handleError(error, "loadToday");
      } else {
        if (isStale()) return;
        setTodayInstances(data ?? []);
        if (data?.length) {
          if (isStale()) return;
          let preempt: PreemptCandidate | null = null;
          try {
            const blockIds = Array.from(
              new Set(data.map((i) => i.block_id).filter(Boolean))
            );
            if (blockIds.length) {
              const { data: hist } = await supabase
                .from("daily_schedule_instances")
                .select("block_id, date, status")
                .in("block_id", blockIds)
                .lt("date", targetDate)
                .in("status", ["completed", "missed", "unaccounted"])
                .order("date", { ascending: false })
                .limit(400);

              if (hist) {
                const now = new Date();
                preempt = pickPreemptTarget(
                  data,
                  hist,
                  now.getHours() * 60 + now.getMinutes()
                );
              }
            }
          } catch (err) {
            // A failed history lookup must never block the day from loading.
            handleError(err, "preemptHistory");
          }
          setTodayPreempt(preempt);
          setTodayInsights(insightsData ?? []);
          try {
            const cutoffs = await scheduleTodayBlockNotifications(
              data,
              targetDate,
              insightsData ?? [],
              preempt
            );
            if (cutoffs.length > 0) {
              const { error: nudgeError } = await (
                supabase as typeof supabase & {
                  from: (table: "nudge_events") => ReturnType<typeof supabase.from>;
                }
              )
                .from("nudge_events")
                .upsert(
                  cutoffs.map((c) => ({
                    user_id: userId,
                    instance_id: c.instanceId,
                    kind: "cutoff",
                    scheduled_for: c.scheduledFor.toISOString(),
                  })),
                  { onConflict: "instance_id,kind" }
                );
              if (nudgeError) throw nudgeError;
            }
          } catch (err) {
            handleError(err, "scheduleBlockNotifications");
          }
        }
      }

      if (adhocError) {
        setLoadFailed(true);
        setLoadOffline(isConnectivityError(adhocError));
        handleError(adhocError, "loadToday adhoc");
      } else {
        if (isStale()) return;
        setAdhocTasks(adhoc ?? []);
      }

      if (insightsError) {
        setLoadFailed(true);
        setLoadOffline(isConnectivityError(insightsError));
        handleError(insightsError, "loadToday insights");
      } else {
        if (isStale()) return;
        setInsights(insightsData ?? []);
      }

      // Fire-and-forget. Returns cached insights without an AI call if a fresh
      // set exists, so this is cheap to call on every load.
      supabase.functions
        .invoke("weekly-insight")
        .then(({ error }) => {
          if (error) handleError(error, "weeklyInsightInvoke");
        })
        .catch((e) => handleError(e, "weeklyInsightInvoke"));
      } catch (err) {
        handleError(err, "loadToday");
        if (!isStale()) setLoadFailed(true);
      } finally {
        if (!options?.silent && !isStale()) setLoading(false);
      }
    },
    [userId, setTodayInstances, setTodayPreempt, setTodayInsights]
  );

  const isFirstFocus = useRef(true);

  useEffect(() => {
    loadToday();
  }, [userId, loadToday]);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      loadToday(undefined, { silent: true });
    }, [loadToday])
  );

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
    loadFailed,
    loadOffline,
    reload: loadToday,
    resetToday,
    adhocTasks,
    timedAdhoc,
    anytimeAdhoc,
    updateAdhocTask,
    removeAdhocTask,
    restoreAdhocTask,
    insights,
  };
}
