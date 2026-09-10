import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlockTask, DailyInstance, ScheduleBlock } from "../../src/types/database";
import { Colors, spacing, radii, typography } from "../../src/theme";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAuth } from "../../src/providers/AuthProvider";
import { useStore } from "../../src/store";
import { supabase } from "../../src/lib/supabase";
import { handleError } from "../../src/lib/errors";
import { track } from "../../src/lib/analytics";
import {
  createBlockTask,
  deleteBlockTask,
  listBlockTasks,
  moveBlockTask,
  renameBlockTask,
  setBlockTaskDone,
} from "../../src/lib/blockTasks";
import { addDays, isWithinEditWindow } from "../../src/lib/stats";
import { getLocalDateString, minutesToTime } from "../../src/lib/time";
import { runsOn, upcomingRunDates } from "../../src/lib/recurrence";
import { PressableScale } from "../../src/components/PressableScale";
import { BrandLoader } from "../../src/components/BrandLoader";
import { RequireAuth } from "../../src/components/RequireAuth";
import { BlockTaskRow } from "../../src/components/BlockTaskRow";
import { TaskMovePicker } from "../../src/components/TaskMovePicker";

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace("/today");
}

function param(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function BlockTasksScreenContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const instanceId = param(id);
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [instance, setInstance] = useState<DailyInstance | null>(null);
  const [tasks, setTasks] = useState<BlockTask[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addDraft, setAddDraft] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveDate, setMoveDate] = useState<string | null>(null);
  const [moveBlockId, setMoveBlockId] = useState<string | null>(null);

  const movingTask = useMemo(
    () => (movingId ? tasks.find((t) => t.id === movingId) ?? null : null),
    [movingId, tasks]
  );
  const canEdit = instance
    ? isWithinEditWindow(instance.date, getLocalDateString())
    : false;

  const sourceBlock =
    instance?.block ?? blocks.find((b) => b.id === instance?.block_id);
  const dateOptions = useMemo(() => {
    if (!sourceBlock || !instance?.date) return [];
    const later = upcomingRunDates(
      sourceBlock,
      addDays(instance.date, 1),
      8
    );
    return [instance.date, ...later.filter((d) => d !== instance.date)];
  }, [sourceBlock, instance?.date]);
  const firstDate = dateOptions[0] ?? null;

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

  useEffect(() => {
    if (!instanceId || !session?.user.id) return;
    let cancelled = false;
    const fromStore =
      useStore.getState().todayInstances.find((i) => i.id === instanceId) ??
      null;

    (async () => {
      try {
        let row = fromStore;
        if (!row) {
          const { data, error } = await supabase
            .from("daily_schedule_instances")
            .select("*, block:schedule_blocks(*)")
            .eq("id", instanceId)
            .eq("user_id", session.user.id)
            .maybeSingle();
          if (error) throw error;
          row = data;
        }
        if (cancelled) return;
        if (!row) {
          leave();
          return;
        }
        setInstance(row);

        const [{ data: taskRows, error: taskError }, blocksResult] =
          await Promise.all([
            listBlockTasks(session.user.id, row.date),
            supabase
              .from("schedule_blocks")
              .select("*")
              .eq("user_id", session.user.id)
              .eq("is_active", true),
          ]);
        if (cancelled) return;
        if (taskError) handleError(taskError, "listBlockTasks");
        const forBlock = (taskRows ?? []).filter((t) => t.block_id === row.block_id);
        setTasks(forBlock);
        if (blocksResult.error) handleError(blocksResult.error, "loadTaskBlocks");
        else setBlocks(blocksResult.data ?? []);
      } catch (err) {
        handleError(err, "loadBlockTasks", "Couldn't load those tasks");
        leave();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [instanceId, session?.user.id]);

  const pickDate = (d: string) => {
    setMoveDate(d);
    const dest = blocks.filter((b) => b.is_active && runsOn(b, d));
    setMoveBlockId((current) => {
      if (current && dest.some((b) => b.id === current)) return current;
      if (instance?.block_id && dest.some((b) => b.id === instance.block_id)) {
        return instance.block_id;
      }
      return dest[0]?.id ?? null;
    });
  };

  const handleAdd = async () => {
    if (!session?.user.id || !instance || !canEdit) return;
    const trimmed = addDraft.trim();
    if (!trimmed) return;
    setAddDraft("");
    setSaving(true);
    try {
      const { data, error } = await createBlockTask(
        session.user.id,
        instance.block_id,
        instance.date,
        trimmed
      );
      if (error) {
        setAddDraft(trimmed);
        return;
      }
      if (data) {
        setTasks((prev) => [...prev, data]);
        track("task_added", { surface: "today" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (row: BlockTask) => {
    if (!canEdit) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === row.id ? { ...t, done: !t.done } : t))
    );
    const { error } = await setBlockTaskDone(row.id, !row.done);
    if (error) {
      setTasks((prev) =>
        prev.map((t) => (t.id === row.id ? { ...t, done: row.done } : t))
      );
    }
  };

  const handleRename = async (row: BlockTask, name: string) => {
    if (!canEdit) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === row.id ? { ...t, name } : t))
    );
    const { data, error } = await renameBlockTask(row.id, name);
    if (error) {
      setTasks((prev) =>
        prev.map((t) => (t.id === row.id ? { ...t, name: row.name } : t))
      );
      return;
    }
    if (data) {
      setTasks((prev) => prev.map((t) => (t.id === data.id ? data : t)));
    }
  };

  const handleDelete = async (row: BlockTask) => {
    if (!canEdit) return;
    setTasks((prev) => prev.filter((t) => t.id !== row.id));
    if (movingId === row.id) setMovingId(null);
    const { error } = await deleteBlockTask(row.id);
    if (error) {
      setTasks((prev) => {
        if (prev.some((t) => t.id === row.id)) return prev;
        return [...prev, row];
      });
    }
  };

  const handleReschedule = (row: BlockTask) => {
    if (!canEdit) return;
    if (movingId === row.id) {
      setMovingId(null);
      return;
    }
    setMovingId(row.id);
    setMoveDate(instance?.date ?? firstDate);
    setMoveBlockId(instance?.block_id ?? row.block_id);
  };

  const handleMove = async () => {
    if (!movingTask || !canMove || !moveDate || !moveBlockId || !canEdit) return;
    setSaving(true);
    try {
      const { error } = await moveBlockTask(movingTask.id, moveBlockId, moveDate);
      if (error) return;
      const leftThisList =
        moveDate !== instance?.date || moveBlockId !== instance?.block_id;
      if (leftThisList) {
        setTasks((prev) => prev.filter((t) => t.id !== movingTask.id));
      }
      setMovingId(null);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !instance) {
    return (
      <View style={styles.centered}>
        <BrandLoader size={56} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{instance.block?.name ?? "Tasks"}</Text>
          <Text style={styles.subtitle}>
            {minutesToTime(instance.start_minutes)} –{" "}
            {minutesToTime(instance.end_minutes)}
          </Text>
        </View>
        <PressableScale onPress={leave} hitSlop={12}>
          <Feather name="x" size={22} color={colors.textSecondary} />
        </PressableScale>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <TextInput
          style={styles.input}
          value={addDraft}
          onChangeText={setAddDraft}
          placeholder="Add a task"
          placeholderTextColor={colors.textPlaceholder}
          returnKeyType="done"
          blurOnSubmit={false}
          onSubmitEditing={handleAdd}
          editable={canEdit}
        />
        <PressableScale
          style={[
            styles.primaryBtn,
            (!addDraft.trim() || !canEdit) && styles.btnDisabled,
          ]}
          onPress={handleAdd}
          disabled={saving || !canEdit || !addDraft.trim()}
        >
          {saving ? (
            <BrandLoader size={20} />
          ) : (
            <Text style={styles.primaryBtnText}>Add</Text>
          )}
        </PressableScale>
        {tasks.map((row) => (
          <View key={row.id} style={styles.taskBlock}>
            <BlockTaskRow
              task={row}
              canEdit={canEdit}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onReschedule={handleReschedule}
              onRename={handleRename}
            />
            {movingId === row.id ? (
              <TaskMovePicker
                dateOptions={dateOptions}
                destBlocks={destBlocks}
                moveDate={moveDate}
                moveBlockId={moveBlockId}
                homeBlockId={row.block_id}
                canMove={canMove}
                canEdit={canEdit}
                saving={saving}
                onPickDate={pickDate}
                onPickBlock={setMoveBlockId}
                onMove={handleMove}
              />
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function BlockTasksScreen() {
  return (
    <RequireAuth>
      <BlockTasksScreenContent />
    </RequireAuth>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    centered: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: "center",
      justifyContent: "center",
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xxl,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      gap: spacing.md,
    },
    headerText: { flex: 1 },
    title: {
      color: c.text,
      ...typography.heading,
    },
    subtitle: {
      color: c.textMuted,
      ...typography.small,
      marginTop: spacing.xs,
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: spacing.xxl,
      paddingBottom: spacing.xxxl,
      gap: spacing.md,
    },
    input: {
      backgroundColor: c.surfaceNested,
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      color: c.text,
      ...typography.body,
    },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    primaryBtnText: {
      ...typography.bodyBold,
      color: c.onPrimary,
    },
    btnDisabled: { opacity: 0.5 },
    taskBlock: { gap: spacing.sm },
  });
