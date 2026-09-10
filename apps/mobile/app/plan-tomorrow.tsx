import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { generateDailyInstances, supabase } from "../src/lib/supabase";
import { WEEKDAYS } from "../src/lib/schedule";
import { getLocalDateString, getTomorrowLocalDateString, minutesToTime } from "../src/lib/time";
import { handleError, isConnectivityError } from "../src/lib/errors";
import { useAuth } from "../src/providers/AuthProvider";
import { useTheme } from "../src/providers/ThemeProvider";
import { RequireAuth } from "../src/components/RequireAuth";
import { BrandLoader } from "../src/components/BrandLoader";
import { LoadError } from "../src/components/LoadError";
import { PressableScale } from "../src/components/PressableScale";
import { CloseTodayRow } from "../src/components/CloseTodayRow";
import { BlockTaskRow } from "../src/components/BlockTaskRow";
import { TaskMovePicker } from "../src/components/TaskMovePicker";
import { DailyInstance, BlockTask, ScheduleBlock } from "../src/types/database";
import { Colors, spacing, radii, typography, iconSizes } from "../src/theme";
import {
  listBlockTasks,
  groupBlockTasks,
  createBlockTask,
  setBlockTaskDone,
  deleteBlockTask,
  moveBlockTask,
  renameBlockTask,
} from "../src/lib/blockTasks";
import { addDays } from "../src/lib/stats";
import { track } from "../src/lib/analytics";
import { runsOn, upcomingRunDates } from "../src/lib/recurrence";

function isInstanceFixed(instance: DailyInstance): boolean {
  return instance.is_fixed || !!instance.block?.is_fixed;
}

// The nightly notification replace()s onto this screen, so cold launch has
// no stack to pop. From Today it is a push and back() is correct.
function leaveTonight() {
  if (router.canGoBack()) router.back();
  else router.replace("/today");
}

function PlanTomorrowScreenContent() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuth();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const tomorrowDate = useMemo(() => getTomorrowLocalDateString(), []);
  const tomorrowWeekday = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return WEEKDAYS[t.getDay()].label;
  }, []);

  const [instances, setInstances] = useState<DailyInstance[]>([]);
  const [closeTodayInstances, setCloseTodayInstances] = useState<DailyInstance[]>([]);
  const [awaitingPresetIds, setAwaitingPresetIds] = useState<Set<string>>(new Set());
  const [blockTasks, setBlockTasks] = useState<BlockTask[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [addDrafts, setAddDrafts] = useState<Record<string, string>>({});
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveDate, setMoveDate] = useState<string | null>(null);
  const [moveBlockId, setMoveBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadOffline, setLoadOffline] = useState(false);

  const loadPlan = useCallback(async () => {
    if (!session?.user.id) return;

    setLoading(true);
    setLoadFailed(false);
    try {
      await generateDailyInstances(tomorrowDate);

      const todayDate = getLocalDateString();

      const [tomorrowResult, closeTodayResult, blocksResult] = await Promise.all([
        supabase
          .from("daily_schedule_instances")
          .select("*, block:schedule_blocks(*)")
          .eq("user_id", session.user.id)
          .eq("date", tomorrowDate)
          .neq("status", "removed")
          .order("start_minutes"),
        supabase
          .from("daily_schedule_instances")
          .select("*, block:schedule_blocks!inner(*)")
          .eq("user_id", session.user.id)
          .eq("date", todayDate)
          .in("status", ["pending", "active"])
          .neq("block.category", "wind_down")
          .order("start_minutes"),
        supabase
          .from("schedule_blocks")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("is_active", true),
      ]);

      if (tomorrowResult.error) throw tomorrowResult.error;
      if (closeTodayResult.error) throw closeTodayResult.error;
      if (blocksResult.error) handleError(blocksResult.error, "loadPlanBlocks");

      const rows = tomorrowResult.data ?? [];
      const { data: tasks, error: tasksError } = await listBlockTasks(
        session.user.id,
        tomorrowDate
      );
      if (tasksError) handleError(tasksError, "listBlockTasks");

      setInstances(rows);
      setCloseTodayInstances(closeTodayResult.data ?? []);
      setBlocks(blocksResult.data ?? []);
      setBlockTasks(tasks ?? []);
      setAddDrafts({});
    } catch (err) {
      setLoadFailed(true);
      setLoadOffline(isConnectivityError(err));
      handleError(err, "loadPlanTomorrow");
    } finally {
      setLoading(false);
    }
  }, [session?.user.id, tomorrowDate]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  useEffect(() => {
    track("plan_tomorrow_opened", {
      source: source === "notification" ? "notification" : "menu",
    });
  }, []);

  const tasksByBlockId = useMemo(
    () => groupBlockTasks(blockTasks),
    [blockTasks]
  );

  const movingTask = useMemo(
    () => (movingId ? blockTasks.find((t) => t.id === movingId) ?? null : null),
    [movingId, blockTasks]
  );
  const sourceBlock =
    (movingTask
      ? blocks.find((b) => b.id === movingTask.block_id)
      : null) ??
    (movingTask
      ? (instances.find((i) => i.block_id === movingTask.block_id)?.block as
          | ScheduleBlock
          | undefined)
      : null);
  const dateOptions = useMemo(() => {
    if (!sourceBlock) return [];
    const later = upcomingRunDates(sourceBlock, addDays(tomorrowDate, 1), 8);
    return [tomorrowDate, ...later.filter((d) => d !== tomorrowDate)];
  }, [sourceBlock, tomorrowDate]);
  const destBlocks = useMemo(() => {
    if (!moveDate) return [];
    const list = blocks.filter((b) => b.is_active && runsOn(b, moveDate));
    if (list.length > 0) return list;
    if (sourceBlock && runsOn(sourceBlock, moveDate)) {
      return [sourceBlock as ScheduleBlock];
    }
    return [];
  }, [blocks, moveDate, sourceBlock]);
  const canMove =
    !!movingTask &&
    !!moveDate &&
    !!moveBlockId &&
    (moveDate !== movingTask.date || moveBlockId !== movingTask.block_id);

  const pickDate = (d: string) => {
    setMoveDate(d);
    const dest = blocks.filter((b) => b.is_active && runsOn(b, d));
    setMoveBlockId((current) => {
      if (current && dest.some((b) => b.id === current)) return current;
      if (
        movingTask?.block_id &&
        dest.some((b) => b.id === movingTask.block_id)
      ) {
        return movingTask.block_id;
      }
      return dest[0]?.id ?? null;
    });
  };

  const closeTodayLeft = closeTodayInstances.filter(
    (i) => i.status === "pending" || i.status === "active"
  ).length;
  const closeTodayVisible = closeTodayInstances.filter(
    (i) =>
      i.status === "pending" ||
      i.status === "active" ||
      awaitingPresetIds.has(i.id)
  );
  const showCloseToday = closeTodayVisible.length > 0;

  const handleCloseTodayStatus = async (
    instanceId: string,
    status: "completed" | "missed"
  ) => {
    // A miss is not committed here. Tapping Missed only opens the reason
    // step; the write happens when the user picks a reason or explicitly
    // declines one. Leaving the screen mid-flow must leave the block
    // pending — the evening sweep will ask again, and an unanswered block
    // is honest where a fabricated miss is not.
    if (status === "missed") {
      setCloseTodayInstances((prev) =>
        prev.map((i) => (i.id === instanceId ? { ...i, status } : i))
      );
      setAwaitingPresetIds((prev) => new Set(prev).add(instanceId));
      return;
    }

    const previous = closeTodayInstances;
    setCloseTodayInstances((prev) =>
      prev.map((i) => (i.id === instanceId ? { ...i, status } : i))
    );
    setAwaitingPresetIds((prev) => {
      const next = new Set(prev);
      next.delete(instanceId);
      return next;
    });

    const { error } = await supabase
      .from("daily_schedule_instances")
      .update({ status })
      .eq("id", instanceId);

    if (error) {
      setCloseTodayInstances(previous);
      handleError(error, "closeTodayStatus", "Couldn't save that status");
    }
  };

  const handlePresetTap = async (instanceId: string, tag: string) => {
    const previous = closeTodayInstances;
    setCloseTodayInstances((prev) =>
      prev.map((i) =>
        i.id === instanceId ? { ...i, status: "missed", miss_reason_tag: tag } : i
      )
    );
    setAwaitingPresetIds((prev) => {
      const next = new Set(prev);
      next.delete(instanceId);
      return next;
    });

    // Status and tag land together — this is the first write for this miss.
    const { error } = await supabase
      .from("daily_schedule_instances")
      .update({ status: "missed", miss_reason_tag: tag })
      .eq("id", instanceId);

    if (error) {
      setCloseTodayInstances(previous);
      setAwaitingPresetIds((prev) => new Set(prev).add(instanceId));
      handleError(error, "closeTodayPreset", "Couldn't save that");
      return;
    }
    track("block_missed_marked", { had_reflection: false });
  };

  const handlePresetSkip = async (instanceId: string) => {
    const previous = closeTodayInstances;
    setAwaitingPresetIds((prev) => {
      const next = new Set(prev);
      next.delete(instanceId);
      return next;
    });

    const { error } = await supabase
      .from("daily_schedule_instances")
      .update({ status: "missed" })
      .eq("id", instanceId);

    if (error) {
      setCloseTodayInstances(previous);
      setAwaitingPresetIds((prev) => new Set(prev).add(instanceId));
      handleError(error, "closeTodaySkipReason", "Couldn't save that");
      return;
    }
    track("block_missed_marked", { had_reflection: false });
  };

  const handleUndoMissed = (instanceId: string) => {
    setCloseTodayInstances((prev) =>
      prev.map((i) => (i.id === instanceId ? { ...i, status: "pending" } : i))
    );
    setAwaitingPresetIds((prev) => {
      const next = new Set(prev);
      next.delete(instanceId);
      return next;
    });
  };

  const handleToggleTask = async (task: BlockTask, done: boolean) => {
    setBlockTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done } : t))
    );
    const { error } = await setBlockTaskDone(task.id, done);
    if (error) {
      setBlockTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, done: !done } : t))
      );
    }
  };

  const handleAddTask = async (blockId: string, name?: string) => {
    if (!session?.user.id) return;
    const trimmed = (name ?? addDrafts[blockId] ?? "").trim();
    if (!trimmed) return;
    setAddDrafts((prev) => ({ ...prev, [blockId]: "" }));
    const { data, error } = await createBlockTask(
      session.user.id,
      blockId,
      tomorrowDate,
      trimmed
    );
    if (error) {
      setAddDrafts((prev) => ({ ...prev, [blockId]: trimmed }));
      return false;
    }
    if (data) {
      setBlockTasks((prev) => [...prev, data]);
      track("task_added", { surface: "plan_tomorrow" });
    }
    return true;
  };

  const handleRenameTask = async (row: BlockTask, name: string) => {
    setBlockTasks((prev) =>
      prev.map((t) => (t.id === row.id ? { ...t, name } : t))
    );
    const { data, error } = await renameBlockTask(row.id, name);
    if (error) {
      setBlockTasks((prev) =>
        prev.map((t) => (t.id === row.id ? { ...t, name: row.name } : t))
      );
      return;
    }
    if (data) {
      setBlockTasks((prev) => prev.map((t) => (t.id === data.id ? data : t)));
    }
  };

  const handleDeleteTask = async (row: BlockTask) => {
    setBlockTasks((prev) => prev.filter((t) => t.id !== row.id));
    if (movingId === row.id) setMovingId(null);
    const { error } = await deleteBlockTask(row.id);
    if (error) {
      setBlockTasks((prev) => {
        if (prev.some((t) => t.id === row.id)) return prev;
        return [...prev, row];
      });
    }
  };

  const handleRescheduleTask = (row: BlockTask) => {
    if (movingId === row.id) {
      setMovingId(null);
      return;
    }
    setMovingId(row.id);
    setMoveDate(tomorrowDate);
    setMoveBlockId(row.block_id);
  };

  const handleMoveTask = async () => {
    if (!movingTask || !canMove || !moveDate || !moveBlockId) return;
    setSaving(true);
    try {
      const { error } = await moveBlockTask(
        movingTask.id,
        moveBlockId,
        moveDate
      );
      if (error) return;
      setBlockTasks((prev) =>
        prev
          .map((t) =>
            t.id === movingTask.id
              ? { ...t, block_id: moveBlockId, date: moveDate }
              : t
          )
          .filter((t) => t.date === tomorrowDate)
      );
      setMovingId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDone = async () => {
    const pending = Object.entries(addDrafts)
      .map(([blockId, text]) => [blockId, text.trim()] as const)
      .filter(([, text]) => text.length > 0);
    for (const [blockId, name] of pending) {
      const ok = await handleAddTask(blockId, name);
      if (ok === false) return;
    }
    leaveTonight();
  };

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.centered}>
        <BrandLoader size={56} />
      </View>
    );
  }

  if (loadFailed) {
    return (
      <View style={styles.centered}>
        <LoadError offline={loadOffline} onRetry={loadPlan} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={leaveTonight} hitSlop={8}>
            <Feather name="x" size={iconSizes.md} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Tonight</Text>
            <Text style={styles.subtitle}>
              {tomorrowWeekday} · {tomorrowDate}
            </Text>
          </View>
          <PressableScale onPress={leaveTonight} hitSlop={8}>
            <Text style={styles.skipBtn}>Skip</Text>
          </PressableScale>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {showCloseToday ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>
              Close today · {closeTodayLeft} left
            </Text>
            {closeTodayVisible.map((instance) => (
              <CloseTodayRow
                key={instance.id}
                instance={instance}
                onStatusTap={handleCloseTodayStatus}
                onPresetTap={handlePresetTap}
                onPresetSkip={handlePresetSkip}
                onUndoMissed={handleUndoMissed}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Plan tomorrow</Text>
        {instances.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No blocks scheduled for tomorrow.</Text>
            <PressableScale
              style={styles.emptyBtn}
              onPress={() => router.replace("/schedule-builder?source=menu")}
            >
              <Text style={styles.emptyBtnText}>Edit schedule</Text>
            </PressableScale>
          </View>
        ) : (
          instances.map((instance) => {
            const fixed = isInstanceFixed(instance);
            return (
              <View
                key={instance.id}
                style={[styles.row, fixed && styles.rowFixed]}
              >
                <View style={styles.rowHeader}>
                  <Text style={styles.blockName}>
                    {instance.block?.name ?? "Block"}
                  </Text>
                  {fixed ? (
                    <Feather name="lock" size={iconSizes.sm} color={colors.textMuted} />
                  ) : null}
                </View>
                <Text style={styles.blockTime}>
                  {minutesToTime(instance.start_minutes)} –{" "}
                  {minutesToTime(instance.end_minutes)}
                </Text>
                {(tasksByBlockId[instance.block_id] ?? []).map((task) => (
                  <View key={task.id}>
                    <BlockTaskRow
                      task={task}
                      canEdit
                      fill={fixed ? colors.surfaceDim : colors.surface}
                      onToggle={(row) => handleToggleTask(row, !row.done)}
                      onDelete={handleDeleteTask}
                      onReschedule={handleRescheduleTask}
                      onRename={handleRenameTask}
                    />
                    {movingId === task.id ? (
                      <TaskMovePicker
                        dateOptions={dateOptions}
                        destBlocks={destBlocks}
                        moveDate={moveDate}
                        moveBlockId={moveBlockId}
                        homeBlockId={task.block_id}
                        canMove={canMove}
                        canEdit
                        saving={saving}
                        onPickDate={pickDate}
                        onPickBlock={setMoveBlockId}
                        onMove={handleMoveTask}
                      />
                    ) : null}
                  </View>
                ))}
                <TextInput
                  style={styles.taskInput}
                  value={addDrafts[instance.block_id] ?? ""}
                  onChangeText={(text) =>
                    setAddDrafts((prev) => ({
                      ...prev,
                      [instance.block_id]: text,
                    }))
                  }
                  placeholder="Add a task"
                  placeholderTextColor={colors.textPlaceholder}
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={() => handleAddTask(instance.block_id)}
                />
              </View>
            );
          })
        )}
        </View>
      </ScrollView>

      {instances.length > 0 ? (
        <View style={styles.footer}>
          <PressableScale style={styles.saveBtn} onPress={handleDone}>
            <Text style={styles.saveBtnText}>Done</Text>
          </PressableScale>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export default function PlanTomorrowScreen() {
  return (
    <RequireAuth>
      <PlanTomorrowScreenContent />
    </RequireAuth>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    centered: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: "center",
      justifyContent: "center",
    },
    header: {
      paddingTop: 60,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    headerTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    headerText: { flex: 1 },
    skipBtn: { color: c.primary, ...typography.body },
    title: { fontSize: 24, fontWeight: "600", color: c.text },
    subtitle: { fontSize: 14, color: c.textMuted, marginTop: spacing.xs },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
      gap: spacing.lg,
    },
    section: {
      gap: spacing.md,
    },
    sectionHeader: {
      color: c.textMuted,
      ...typography.smallBold,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    row: {
      backgroundColor: c.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    rowFixed: {
      backgroundColor: c.surfaceDim,
    },
    rowHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    blockName: { color: c.text, fontSize: 16, fontWeight: "600" },
    blockTime: { color: c.textMuted, fontSize: 13 },
    taskInput: {
      backgroundColor: c.surfaceNested,
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      color: c.text,
      fontSize: 15,
    },
    empty: {
      alignItems: "center",
      marginTop: spacing.xxxl,
      gap: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    emptyText: {
      color: c.textFaint,
      fontSize: 15,
      textAlign: "center",
      lineHeight: 22,
    },
    emptyBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    emptyBtnText: { color: c.onPrimary, ...typography.bodyBold },
    footer: {
      paddingHorizontal: spacing.lg,
      paddingBottom: Platform.OS === "ios" ? 36 : spacing.xl,
      paddingTop: spacing.md,
    },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.lg,
      alignItems: "center",
    },
    saveBtnText: { color: c.onPrimary, fontSize: 16, fontWeight: "600" },
  });
