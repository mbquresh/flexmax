import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { generateDailyInstances, supabase } from "../lib/supabase";
import { scheduleTodayBlockNotifications } from "../lib/blockNotifications";
import { pickPreemptTarget, PreemptCandidate } from "../lib/preempt";
import { fetchTodayStats, TodayStats } from "../lib/stats";
import { getLocalDateString } from "../lib/time";
import { handleError, isConnectivityError } from "../lib/errors";
import { AdhocTask, BehavioralInsight, BlockTask } from "../types/database";
import { useStore } from "../store";
import { listBlockTasks, groupBlockTasks, setBlockTaskDone } from "../lib/blockTasks";
import { firstDayKey, trackOnce } from "../lib/analytics";

export function useTodayData(userId: string | undefined) {
  const {
    todayInstances,
    setTodayInstances,
    setTodayPreempt,
    setTodayInsights,
    setTodayBlockTasks,
  } = useStore();
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadOffline, setLoadOffline] = useState(false);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [displayDate, setDisplayDate] = useState(getLocalDateString());
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [adhocTasks, setAdhocTasks] = useState<AdhocTask[]>([]);
  const [blockTasks, setBlockTasks] = useState<BlockTask[]>([]);
  const [insights, setInsights] = useState<BehavioralInsight[]>([]);
  // The date on screen, which is not necessarily today. Kept apart from
  // realTodayRef so a foreground event can tell "the clock rolled over"
  // from "the user is looking at history".
  const viewDateRef = useRef(getLocalDateString());
  const realTodayRef = useRef(getLocalDateString());
  // Every load claims a token. Only the most recent load may write state —
  // an earlier, slower request that resolves last must discard its results.
  const loadSeqRef = useRef(0);
  // Same-session guard so overlapping loadToday calls cannot both miss the
  // AsyncStorage read and double-invoke.
  const insightInvokedDateRef = useRef<string | null>(null);
  // A superseded or failed set leaves Today with nothing. The date lock
  // would then refuse a second call until tomorrow. One empty-set retry
  // per session lets a regenerate happen tonight without a debugger.
  const emptyInsightTriedRef = useRef(false);

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

  const tasksByBlockId = useMemo(
    () => groupBlockTasks(blockTasks),
    [blockTasks]
  );

  const syncTodayTasks = useCallback(
    (next: BlockTask[]) => {
      if (viewDateRef.current !== getLocalDateString()) return;
      setTodayBlockTasks(next);
      const { todayInsights, todayPreempt, todayInstances } =
        useStore.getState();
      scheduleTodayBlockNotifications(
        todayInstances,
        viewDateRef.current,
        todayInsights,
        todayPreempt,
        next
      ).catch((err) => handleError(err, "resyncNotifications"));
    },
    [setTodayBlockTasks]
  );

  const toggleBlockTaskDone = useCallback(async (taskId: string, done: boolean) => {
    let snapshot: BlockTask[] = [];
    let next: BlockTask[] = [];
    setBlockTasks((prev) => {
      snapshot = prev;
      next = prev.map((t) => (t.id === taskId ? { ...t, done } : t));
      return next;
    });
    syncTodayTasks(next);
    const { error } = await setBlockTaskDone(taskId, done);
    if (error) {
      setBlockTasks(snapshot);
      syncTodayTasks(snapshot);
    }
  }, [syncTodayTasks]);

  const loadToday = useCallback(
    async (dateOverride?: string, options?: { silent?: boolean }) => {
      if (!userId) return;

      const seq = ++loadSeqRef.current;
      const isStale = () => seq !== loadSeqRef.current;

      const realToday = getLocalDateString();
      const targetDate = dateOverride ?? realToday;
      const isToday = targetDate === realToday;
      const isPast = targetDate < realToday;
      setDisplayDate(targetDate);
      viewDateRef.current = targetDate;
      realTodayRef.current = realToday;
      if (!options?.silent) {
        setLoading(true);
        setLoadFailed(false);
      }

      try {
      // Generation mints a row for every active block whose weekday matches
      // the target date. On a past date that FABRICATES history: a block
      // created last week would appear on days it did not exist, and a
      // block whose days changed would appear on days it was never set for.
      // Today and forward only — a past day shows exactly what was there.
      //
      // Idempotent (on conflict do nothing) and the fetch below returns
      // whatever already exists, so a slow or hung generate must not hold
      // the whole screen.
      if (!isPast) {
        try {
          await Promise.race([
            generateDailyInstances(targetDate),
            new Promise((resolve) => setTimeout(resolve, 8000)),
          ]);
        } catch (err) {
          handleError(err, "loadToday generate");
        }
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

      const { data: tasks, error: tasksError } = await listBlockTasks(
        userId,
        targetDate
      );

      const { data: insightsData, error: insightsError } = await supabase
        .from("behavioral_insights")
        .select("id, kind, belief, suggestion, related_blocks, rank, generated_at, nudge_line, disputed_at")
        .eq("superseded", false)
        .is("disputed_at", null)
        .order("rank");

      if (error) {
        setLoadFailed(true);
        setLoadOffline(isConnectivityError(error));
        handleError(error, "loadToday");
      } else {
        if (isStale()) return;
        setTodayInstances(data ?? []);
        if (isToday && (data?.length ?? 0) > 0) {
          trackOnce(firstDayKey(userId), "day_first_viewed");
        }
        setTodayInsights(insightsData ?? []);
        // Everything below acts on the CURRENT day: the pre-block nudge is
        // relative to now, and scheduleTodayBlockNotifications cancels the
        // whole managed set before rebuilding from its arguments. Running
        // either against a past day would wipe today's notifications and
        // replace them with nothing, since every past block is already
        // behind us.
        if (!isToday) {
          setTodayPreempt(null);
        } else if (data?.length) {
          if (isStale()) return;
          let preempt: PreemptCandidate | null = null;
          try {
            const blockIds = Array.from(
              new Set(data.map((i) => i.block_id).filter(Boolean))
            );
            if (blockIds.length) {
              const now = new Date();
              const nowMinutes = now.getHours() * 60 + now.getMinutes();

              const { data: hist } = await supabase
                .from("daily_schedule_instances")
                .select("block_id, date, status")
                .in("block_id", blockIds)
                .lt("date", targetDate)
                .in("status", ["completed", "missed", "unaccounted"])
                .order("date", { ascending: false })
                .limit(400);

              preempt = pickPreemptTarget(data, hist ?? [], nowMinutes);
            }
          } catch (err) {
            // A failed history lookup must never block the day from loading.
            handleError(err, "preemptHistory");
          }
          setTodayPreempt(preempt);
          try {
            const cutoffs = await scheduleTodayBlockNotifications(
              data,
              targetDate,
              insightsData ?? [],
              preempt,
              tasks ?? []
            );
            if (cutoffs.length > 0) {
              const { error: nudgeError } = await supabase
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

      if (tasksError) {
        handleError(tasksError, "loadToday blockTasks");
      } else if (!isStale()) {
        setBlockTasks(tasks ?? []);
        if (isToday) setTodayBlockTasks(tasks ?? []);
      }

      if (insightsError) {
        setLoadFailed(true);
        setLoadOffline(isConnectivityError(insightsError));
        handleError(insightsError, "loadToday insights");
      } else {
        if (isStale()) return;
        setInsights(insightsData ?? []);
      }

      // Fire-and-forget, at most once per local date. The function returns
      // cached insights without an AI call except on Mon/Wed/Fri (and when
      // the set is 7+ days old). A new user misses that cache on every
      // Today load and runs the full evidence RPC for insufficient_data.
      // Reload when the body says a new set was written.
      // Mark before the call so overlapping loads cannot double-fire.
      // History loads stay skipped: scrubbing weeks must not invoke.
      //
      // Exception: no live rows (superseded, or a failed generate). The
      // date lock would otherwise sit on a blank Theory of You until
      // tomorrow. One empty-set invoke per session, then a silent reload
      // so the new rows appear.
      const invokeWeeklyInsight = (reloadAfter: boolean) => {
        insightInvokedDateRef.current = realToday;
        AsyncStorage.setItem(`weekly_insight_invoked_${userId}`, realToday).catch(
          () => {}
        );
        supabase.functions
          .invoke("weekly-insight", { body: { local_date: realToday } })
          .then(({ data, error }) => {
            if (error) handleError(error, "weeklyInsightInvoke");
            else if ((reloadAfter || data?.cached === false) && !isStale()) {
              loadToday(viewDateRef.current, { silent: true });
            }
          })
          .catch((e) => handleError(e, "weeklyInsightInvoke"));
      };

      const noLiveInsights = !insightsError && !(insightsData?.length);
      if (isToday && noLiveInsights && !emptyInsightTriedRef.current) {
        emptyInsightTriedRef.current = true;
        invokeWeeklyInsight(true);
      } else if (isToday && insightInvokedDateRef.current !== realToday) {
        const last = await AsyncStorage.getItem(
          `weekly_insight_invoked_${userId}`
        ).catch(() => null);
        if (last !== realToday) invokeWeeklyInsight(false);
        else insightInvokedDateRef.current = realToday;
      }
      } catch (err) {
        handleError(err, "loadToday");
        if (!isStale()) setLoadFailed(true);
      } finally {
        if (!options?.silent && !isStale()) setLoading(false);
      }
    },
    [userId, setTodayInstances, setTodayPreempt, setTodayInsights, setTodayBlockTasks]
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
      // The day on screen, not necessarily today — returning from a check-in
      // sheet must not silently yank the user out of the day they are
      // backfilling.
      loadToday(viewDateRef.current, { silent: true });
    }, [loadToday])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      const freshDate = getLocalDateString();
      // Only a real rollover. Gating on the VIEWED date would reload on
      // every foreground while reading history, and gating on nothing would
      // reload after a Control Center swipe.
      if (freshDate === realTodayRef.current) return;
      realTodayRef.current = freshDate;
      loadToday(freshDate);
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

  const goToDate = useCallback(
    (dateStr: string) => {
      loadToday(dateStr);
    },
    [loadToday]
  );

  const backToToday = useCallback(() => {
    loadToday(getLocalDateString());
  }, [loadToday]);

  const isPastDay = displayDate < getLocalDateString();

  return {
    instances: todayInstances,
    displayDate,
    isPastDay,
    goToDate,
    backToToday,
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
    tasksByBlockId,
    toggleBlockTaskDone,
  };
}
