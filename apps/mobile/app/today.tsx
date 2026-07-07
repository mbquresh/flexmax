import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
  Modal,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Animated as RNAnimated,
  Keyboard,
  Platform,
  ActionSheetIOS,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { findRescheduleSlot, getTodayLabel } from "../src/lib/schedule";
import { handleError } from "../src/lib/errors";
import { useAuth } from "../src/providers/AuthProvider";
import { useStore } from "../src/store";
import {
  CompletionRating,
  AdhocTask,
  DailyInstance,
} from "../src/types/database";
import { minutesToTime, timeToMinutes } from "../src/lib/time";
import { getInitials } from "../src/lib/format";
import { RequireAuth } from "../src/components/RequireAuth";
import { StreakStrip } from "../src/components/StreakStrip";
import { CheckInSheet } from "../src/components/CheckInSheet";
import { TaskDetailSheet } from "../src/components/TaskDetailSheet";
import { RecoverySheet, RecoveryAIContent } from "../src/components/RecoverySheet";
import { BlockCard } from "../src/components/BlockCard";
import { AdhocTimedCard } from "../src/components/AdhocTimedCard";
import { AdhocAnytimeRow } from "../src/components/AdhocAnytimeRow";
import { TimeField } from "../src/components/TimeField";
import { useTodayData } from "../src/hooks/useTodayData";
import { colors, spacing, radii, typography } from "../src/theme";

function TodayScreenContent() {
  const { session, signOut, psychologyProfile, profile } = useAuth();
  const {
    instances,
    displayDate,
    totalBlocks,
    stats,
    loading,
    reload,
    resetToday,
    timedAdhoc,
    anytimeAdhoc,
    updateAdhocTask,
  } = useTodayData(session?.user.id);
  const { setTodayInstances, updateInstance } = useStore();
  const [checkInInstance, setCheckInInstance] = useState<DailyInstance | null>(null);
  const [undoInstance, setUndoInstance] = useState<DailyInstance | null>(null);
  const [recoveryInstance, setRecoveryInstance] = useState<DailyInstance | null>(null);
  const [recoveryAI, setRecoveryAI] = useState<RecoveryAIContent | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [reflectionWhy, setReflectionWhy] = useState("");
  const [reflectionImprove, setReflectionImprove] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState<{
    start_minutes: number;
    end_minutes: number;
  } | null>(null);
  const [activeTaskDetailInstance, setActiveTaskDetailInstance] =
    useState<DailyInstance | null>(null);
  const [taskDetailDraft, setTaskDetailDraft] = useState("");
  const [removeInstance, setRemoveInstance] = useState<DailyInstance | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskName, setAddTaskName] = useState("");
  const [addTaskMode, setAddTaskMode] = useState<"timed" | "anytime">("timed");
  const [addTaskStart, setAddTaskStart] = useState("9:00 AM");
  const [addTaskEnd, setAddTaskEnd] = useState("9:30 AM");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const checkInSlideAnim = useRef(new RNAnimated.Value(400)).current;
  const taskSlideAnim = useRef(new RNAnimated.Value(400)).current;
  const toastOpacity = useSharedValue(0);
  const toastY = useSharedValue(60);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardPositions = useRef<Record<string, { y: number; height: number }>>({});
  const flashTriggers = useRef<Record<string, () => void>>({});
  const todayLabel = getTodayLabel();

  const sortedInstances = [...instances].sort(
    (a, b) => a.start_minutes - b.start_minutes
  );

  const timelineItems = useMemo(() => {
    const items = [
      ...sortedInstances.map((instance) => ({
        kind: "block" as const,
        instance,
        sortKey: instance.start_minutes,
      })),
      ...timedAdhoc.map((task) => ({
        kind: "adhoc" as const,
        task,
        sortKey: task.start_minutes!,
      })),
    ];
    return items.sort((a, b) => a.sortKey - b.sortKey);
  }, [sortedInstances, timedAdhoc]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (checkInInstance) {
      checkInSlideAnim.setValue(400);
      RNAnimated.spring(checkInSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
      }).start();
    }
  }, [checkInInstance, checkInSlideAnim]);

  useEffect(() => {
    if (activeTaskDetailInstance) {
      taskSlideAnim.setValue(400);
      RNAnimated.spring(taskSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
      }).start();
    }
  }, [activeTaskDetailInstance, taskSlideAnim]);

  const confirmReset = () => {
    if (Platform.OS === "web") {
      resetToday();
      return;
    }
    Alert.alert(
      "Reset today?",
      "This clears all changes, check-ins, and swaps for today and restores your default schedule. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: resetToday },
      ]
    );
  };

  const toastAnimatedStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
    transform: [{ translateY: toastY.value }],
  }));

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);

    setToastMessage(message);
    toastY.value = 60;
    toastOpacity.value = 0;
    toastY.value = withTiming(0, { duration: 250 });
    toastOpacity.value = withTiming(1, { duration: 250 });

    toastTimeoutRef.current = setTimeout(() => {
      toastOpacity.value = withTiming(0, { duration: 250 });
      toastY.value = withTiming(60, { duration: 250 });
      setTimeout(() => setToastMessage(null), 250);
    }, 2000);
  };

  const registerFlashTrigger = useCallback((id: string, trigger: () => void) => {
    flashTriggers.current[id] = trigger;
  }, []);

  const unregisterFlashTrigger = useCallback((id: string) => {
    delete flashTriggers.current[id];
  }, []);

  const triggerFlash = (id: string) => {
    flashTriggers.current[id]?.();
  };

  const handleCardLayout = useCallback((id: string, y: number, height: number) => {
    cardPositions.current[id] = { y, height };
  }, []);

  const handleSwap = async (instanceA: DailyInstance, instanceB: DailyInstance) => {
    if (instanceA.is_fixed || instanceA.block?.is_fixed) return;
    if (instanceB.is_fixed || instanceB.block?.is_fixed) return;

    const durationA = instanceA.end_minutes - instanceA.start_minutes;
    const durationB = instanceB.end_minutes - instanceB.start_minutes;

    const [earlier, later] =
      instanceA.start_minutes < instanceB.start_minutes
        ? [instanceA, instanceB]
        : [instanceB, instanceA];
    const earlierDuration = earlier.end_minutes - earlier.start_minutes;
    const laterDuration = later.end_minutes - later.start_minutes;

    const wereAdjacent = earlier.end_minutes === later.start_minutes;

    let newAStart: number;
    let newAEnd: number;
    let newBStart: number;
    let newBEnd: number;

    if (wereAdjacent) {
      const laterNewStart = earlier.start_minutes;
      const laterNewEnd = laterNewStart + laterDuration;
      const earlierNewStart = laterNewEnd;
      const earlierNewEnd = earlierNewStart + earlierDuration;

      if (earlier.id === instanceA.id) {
        newAStart = earlierNewStart;
        newAEnd = earlierNewEnd;
        newBStart = laterNewStart;
        newBEnd = laterNewEnd;
      } else {
        newAStart = laterNewStart;
        newAEnd = laterNewEnd;
        newBStart = earlierNewStart;
        newBEnd = earlierNewEnd;
      }
    } else {
      newAStart = instanceB.start_minutes;
      newAEnd = newAStart + durationA;
      newBStart = instanceA.start_minutes;
      newBEnd = newBStart + durationB;

      const otherBlocks = instances.filter(
        (inst) =>
          inst.id !== instanceA.id &&
          inst.id !== instanceB.id &&
          inst.status !== "skipped" &&
          inst.status !== "removed"
      );
      const overlaps = (start: number, end: number, other: DailyInstance) =>
        start < other.end_minutes && end > other.start_minutes;

      const swappedCollide = newAStart < newBEnd && newAEnd > newBStart;
      const conflictA = otherBlocks.find((o) => overlaps(newAStart, newAEnd, o));
      const conflictB = otherBlocks.find((o) => overlaps(newBStart, newBEnd, o));

      if (conflictA || conflictB || swappedCollide) {
        const conflictName =
          conflictA?.block?.name ?? conflictB?.block?.name ?? "another block";
        const tooBig = conflictA ? instanceA : instanceB;
        showToast(
          `Can't swap — ${tooBig.block?.name ?? "block"} doesn't fit there without overlapping ${conflictName}`
        );
        return;
      }
    }

    const { error: swapError } = await supabase.rpc("swap_instance_times", {
      instance_a_id: instanceA.id,
      a_start: newAStart,
      a_end: newAEnd,
      instance_b_id: instanceB.id,
      b_start: newBStart,
      b_end: newBEnd,
    });

    if (swapError) {
      handleError(swapError, "handleSwap", "Couldn't swap the blocks — please try again");
      return;
    }

    const updated = instances
      .map((inst) => {
        if (inst.id === instanceA.id) {
          return { ...inst, start_minutes: newAStart, end_minutes: newAEnd };
        }
        if (inst.id === instanceB.id) {
          return { ...inst, start_minutes: newBStart, end_minutes: newBEnd };
        }
        return inst;
      })
      .sort((a, b) => a.start_minutes - b.start_minutes);

    setTodayInstances(updated);

    showToast(
      `${instanceA.block?.name ?? "Block"} swapped with ${instanceB.block?.name ?? "block"}`
    );
    triggerFlash(instanceA.id);
    triggerFlash(instanceB.id);
  };

  const handleRemove = async () => {
    if (!removeInstance) return;
    try {
      const { error } = await supabase
        .from("daily_schedule_instances")
        .update({ status: "removed", removed_reason: removeReason.trim() || null })
        .eq("id", removeInstance.id);
      if (error) throw error;
      updateInstance(removeInstance.id, {
        status: "removed",
        removed_reason: removeReason.trim() || null,
      });
      setTodayInstances(instances.filter((i) => i.id !== removeInstance.id));
      showToast(`${removeInstance.block?.name ?? "Block"} removed from today`);
    } catch (err) {
      handleError(err, "handleRemove", "Could not remove the block");
    } finally {
      setRemoveInstance(null);
      setRemoveReason("");
    }
  };

  const openAddTask = () => {
    setAddTaskName("");
    setAddTaskMode("timed");
    setAddTaskStart("9:00 AM");
    setAddTaskEnd("9:30 AM");
    setAddTaskOpen(true);
  };

  const closeAddTask = () => {
    setAddTaskOpen(false);
    setAddTaskName("");
    setAddTaskMode("timed");
    setAddTaskStart("9:00 AM");
    setAddTaskEnd("9:30 AM");
  };

  const handleAddTask = async () => {
    const name = addTaskName.trim();
    if (!name || !session?.user.id) return;

    let start_minutes: number | null = null;
    let end_minutes: number | null = null;

    if (addTaskMode === "timed") {
      start_minutes = timeToMinutes(addTaskStart);
      end_minutes = timeToMinutes(addTaskEnd);
      if (end_minutes <= start_minutes) {
        Alert.alert("Invalid time", "End time must be after start time.");
        return;
      }
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("adhoc_tasks").insert({
        user_id: session.user.id,
        date: displayDate,
        name,
        start_minutes,
        end_minutes,
        status: "pending",
      });
      if (error) throw error;
      closeAddTask();
      await reload();
      showToast(
        addTaskMode === "timed" ? "Task added to timeline" : "Task added to Anytime today"
      );
    } catch (err) {
      handleError(err, "handleAddTask", "Could not add task");
    } finally {
      setSaving(false);
    }
  };

  const toggleAdhocComplete = async (task: AdhocTask) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    updateAdhocTask(task.id, { status: newStatus });
    try {
      const { error } = await supabase
        .from("adhoc_tasks")
        .update({ status: newStatus })
        .eq("id", task.id);
      if (error) throw error;
    } catch (err) {
      updateAdhocTask(task.id, { status: task.status });
      handleError(err, "toggleAdhocComplete", "Could not update task");
    }
  };

  const closeCheckIn = () => {
    RNAnimated.timing(checkInSlideAnim, {
      toValue: 400,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setCheckInInstance(null));
  };

  const closeTaskDetail = () => {
    Keyboard.dismiss();
    RNAnimated.timing(taskSlideAnim, {
      toValue: 400,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setActiveTaskDetailInstance(null);
      setTaskDetailDraft("");
    });
  };

  const openTaskDetail = (item: DailyInstance) => {
    setTaskDetailDraft(item.task_detail ?? "");
    setActiveTaskDetailInstance(item);
  };

  const showUndoActions = (item: DailyInstance) => {
    const isMissed = item.status === "missed";
    const iosOption = isMissed ? "Undo — mark as pending" : "Undo completion";

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [iosOption, "Cancel"],
          cancelButtonIndex: 1,
          destructiveButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            if (isMissed) handleUndoMissed(item.id);
            else handleUndoCompletion(item.id);
          }
        }
      );
      return;
    }

    setUndoInstance(item);
  };

  const handleUndoCompletion = async (instanceId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("daily_schedule_instances")
        .update({ status: "pending", completion_rating: null })
        .eq("id", instanceId);

      if (error) throw error;

      updateInstance(instanceId, {
        status: "pending",
        completion_rating: null,
      });
    } catch (err) {
      handleError(err, "handleUndoCompletion", "Could not undo completion");
    } finally {
      setSaving(false);
      setUndoInstance(null);
    }
  };

  const handleUndoMissed = async (instanceId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("daily_schedule_instances")
        .update({ status: "pending" })
        .eq("id", instanceId);

      if (error) throw error;

      updateInstance(instanceId, { status: "pending" });
    } catch (err) {
      handleError(err, "handleUndoMissed", "Could not undo missed");
    } finally {
      setSaving(false);
      setUndoInstance(null);
    }
  };

  const handleMarkMissed = async (instance: DailyInstance) => {
    if (instance.status !== "pending" && instance.status !== "active") return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("daily_schedule_instances")
        .update({ status: "missed" })
        .eq("id", instance.id);

      if (error) throw error;
      updateInstance(instance.id, { status: "missed" });

      const slot = findRescheduleSlot(
        { ...instance, status: "missed" },
        useStore.getState().todayInstances
      );
      setRescheduleSlot(slot);

      const { count } = await supabase
        .from("daily_schedule_instances")
        .select("*", { count: "exact", head: true })
        .eq("block_id", instance.block_id)
        .eq("status", "missed");

      setRecoveryInstance(instance);
      setReflectionWhy("");
      setReflectionImprove("");
      setRecoveryLoading(true);
      setRecoveryAI(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "missed-block-recovery",
          {
            body: {
              blockName: instance.block?.name ?? "this block",
              missCount: count ?? 1,
              psychologyProfile,
            },
          }
        );
        if (fnError) throw fnError;
        setRecoveryAI(data);
      } catch (err) {
        handleError(err, "fetchRecoveryAI");
        setRecoveryAI({
          acknowledgment: "One miss doesn't break anything — let's figure out what happened.",
          reflection_prompt_why: "What got in the way?",
          reflection_prompt_improve: "What's one thing you'd change next time?",
          pattern_note: null,
        });
      } finally {
        setRecoveryLoading(false);
      }
    } catch (err) {
      handleError(err, "handleMarkMissed", "Could not mark missed");
    } finally {
      setSaving(false);
    }
  };

  const closeRecovery = () => {
    setRecoveryInstance(null);
    setRecoveryAI(null);
    setRescheduleSlot(null);
    setReflectionWhy("");
    setReflectionImprove("");
  };

  const handleSaveRecovery = async () => {
    if (!recoveryInstance) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("daily_schedule_instances")
        .update({
          reflection_why: reflectionWhy.trim() || null,
          reflection_improve: reflectionImprove.trim() || null,
        })
        .eq("id", recoveryInstance.id);

      if (error) throw error;

      updateInstance(recoveryInstance.id, {
        reflection_why: reflectionWhy.trim() || null,
        reflection_improve: reflectionImprove.trim() || null,
      });

      closeRecovery();
    } catch (err) {
      handleError(err, "handleSaveRecovery", "Could not save reflection");
    } finally {
      setSaving(false);
    }
  };

  const handleReschedule = async () => {
    if (!recoveryInstance || !rescheduleSlot) return;

    const { error } = await supabase
      .from("daily_schedule_instances")
      .update({
        start_minutes: rescheduleSlot.start_minutes,
        end_minutes: rescheduleSlot.end_minutes,
        status: "pending",
        rescheduled_to_id: null,
      })
      .eq("id", recoveryInstance.id);

    if (error) {
      handleError(error, "handleReschedule");
      return;
    }

    const updated = {
      ...recoveryInstance,
      start_minutes: rescheduleSlot.start_minutes,
      end_minutes: rescheduleSlot.end_minutes,
      status: "pending" as const,
    };

    updateInstance(recoveryInstance.id, {
      start_minutes: rescheduleSlot.start_minutes,
      end_minutes: rescheduleSlot.end_minutes,
      status: "pending",
    });

    setTodayInstances(
      instances
        .map((i) => (i.id === recoveryInstance.id ? updated : i))
        .sort((a, b) => a.start_minutes - b.start_minutes)
    );

    showToast(
      `${recoveryInstance.block?.name ?? "Block"} rescheduled to ${minutesToTime(rescheduleSlot.start_minutes)}`
    );
    setRecoveryInstance(null);
    setRecoveryAI(null);
  };

  const handleCheckIn = async (rating: CompletionRating) => {
    if (!checkInInstance) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("daily_schedule_instances")
        .update({
          status: "completed",
          completion_rating: rating,
        })
        .eq("id", checkInInstance.id);

      if (error) throw error;

      updateInstance(checkInInstance.id, {
        status: "completed",
        completion_rating: rating,
      });
      closeCheckIn();
    } catch (err) {
      handleError(err, "handleCheckIn", "Could not save check-in");
    } finally {
      setSaving(false);
    }
  };

  const saveTaskDetail = async () => {
    if (!activeTaskDetailInstance) return;

    Keyboard.dismiss();
    const trimmed = taskDetailDraft.trim();
    const instanceId = activeTaskDetailInstance.id;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("daily_schedule_instances")
        .update({ task_detail: trimmed })
        .eq("id", instanceId);

      if (error) throw error;

      updateInstance(instanceId, { task_detail: trimmed || null });
      closeTaskDetail();
    } catch (err) {
      handleError(err, "saveTaskDetail", "Could not save task detail");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Today</Text>
              <Text style={styles.date}>
                {displayDate} · {todayLabel}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => router.push("/account")}
            >
              <Text style={styles.avatarText}>
                {getInitials(profile?.name ?? "U")}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push("/schedule-builder")}>
              <Text style={styles.link}>Edit schedule</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmReset}>
              <Text style={styles.linkDanger}>Reset today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                await signOut();
                router.replace("/sign-in");
              }}
            >
              <Text style={styles.link}>Sign out</Text>
            </TouchableOpacity>
          </View>
          {stats ? <StreakStrip stats={stats} /> : null}
        </View>

        <View style={styles.list}>
          {timelineItems.length === 0 ? (
            <Text style={styles.empty}>
              {totalBlocks > 0
                ? `Nothing scheduled for ${todayLabel}. Your blocks may be set for other days — go to Edit schedule and tap ${todayLabel} on each block.`
                : "No blocks yet. Add some in the schedule builder first."}
            </Text>
          ) : (
            timelineItems.map((item) =>
              item.kind === "block" ? (
                <BlockCard
                  key={item.instance.id}
                  instance={item.instance}
                  saving={saving}
                  cardPositions={cardPositions}
                  onCheckIn={setCheckInInstance}
                  onMarkMissed={handleMarkMissed}
                  onUndo={showUndoActions}
                  onTaskDetail={openTaskDetail}
                  onSwap={handleSwap}
                  onRemoveRequest={setRemoveInstance}
                  onLayout={handleCardLayout}
                  registerFlashTrigger={registerFlashTrigger}
                  unregisterFlashTrigger={unregisterFlashTrigger}
                />
              ) : (
                <AdhocTimedCard
                  key={item.task.id}
                  task={item.task}
                  onToggle={toggleAdhocComplete}
                />
              )
            )
          )}

          <TouchableOpacity style={styles.addAdhocBtn} onPress={openAddTask}>
            <Text style={styles.addAdhocPlus}>+</Text>
            <Text style={styles.addAdhocLabel}>Add task</Text>
          </TouchableOpacity>

          {anytimeAdhoc.length > 0 ? (
            <View style={styles.anytimeTray}>
              <Text style={styles.anytimeTitle}>Anytime today</Text>
              {anytimeAdhoc.map((task) => (
                <AdhocAnytimeRow
                  key={task.id}
                  task={task}
                  onToggle={toggleAdhocComplete}
                />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <RecoverySheet
        recoveryInstance={recoveryInstance}
        recoveryAI={recoveryAI}
        recoveryLoading={recoveryLoading}
        reflectionWhy={reflectionWhy}
        reflectionImprove={reflectionImprove}
        rescheduleSlot={rescheduleSlot}
        saving={saving}
        onSaveRecovery={handleSaveRecovery}
        onReschedule={handleReschedule}
        onChangeWhy={setReflectionWhy}
        onChangeImprove={setReflectionImprove}
        onClose={closeRecovery}
      />

      {toastMessage ? (
        <Animated.View style={[styles.toast, toastAnimatedStyle]} pointerEvents="none">
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      ) : null}

      <CheckInSheet
        instance={checkInInstance}
        visible={!!checkInInstance}
        slideAnim={checkInSlideAnim}
        saving={saving}
        onRate={handleCheckIn}
        onClose={closeCheckIn}
      />

      <TaskDetailSheet
        instance={activeTaskDetailInstance}
        visible={!!activeTaskDetailInstance}
        slideAnim={taskSlideAnim}
        value={taskDetailDraft}
        saving={saving}
        onChangeText={setTaskDetailDraft}
        onSave={saveTaskDetail}
        onClose={closeTaskDetail}
      />

      <Modal
        visible={!!undoInstance}
        transparent
        animationType="fade"
        onRequestClose={() => setUndoInstance(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setUndoInstance(null)}>
          <Pressable style={styles.undoSheet} onPress={(e) => e.stopPropagation()}>
            <TouchableOpacity
              style={styles.undoOption}
              onPress={() => {
                if (!undoInstance) return;
                if (undoInstance.status === "missed") handleUndoMissed(undoInstance.id);
                else handleUndoCompletion(undoInstance.id);
              }}
              disabled={saving}
            >
              <Text style={styles.undoOptionDestructive}>
                {undoInstance?.status === "missed" ? "Undo missed" : "Undo completion"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.undoOption, styles.undoOptionLast]}
              onPress={() => setUndoInstance(null)}
            >
              <Text style={styles.undoOptionCancel}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!removeInstance}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setRemoveInstance(null);
          setRemoveReason("");
        }}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={styles.overlayDismiss}
            onPress={() => {
              setRemoveInstance(null);
              setRemoveReason("");
            }}
          />
          <Pressable style={styles.removeSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.removeTitle}>
              Remove "{removeInstance?.block?.name ?? "Block"}" from today?
            </Text>
            <Text style={styles.removeBody}>
              This frees up the time. It won't affect your schedule on other days.
            </Text>
            <Text style={styles.removeLabel}>Reason (optional)</Text>
            <TextInput
              style={styles.removeInput}
              value={removeReason}
              onChangeText={setRemoveReason}
              placeholder="e.g. something came up"
              placeholderTextColor={colors.textPlaceholder}
              multiline
            />
            <TouchableOpacity style={styles.removeConfirmBtn} onPress={handleRemove}>
              <Text style={styles.removeConfirmText}>Remove</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setRemoveInstance(null);
                setRemoveReason("");
              }}
            >
              <Text style={styles.removeCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={addTaskOpen}
        transparent
        animationType="fade"
        onRequestClose={closeAddTask}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={styles.overlayDismiss} onPress={closeAddTask} />
          <Pressable style={styles.addTaskSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.addTaskTitle}>Add task</Text>
            <TextInput
              style={styles.addTaskInput}
              value={addTaskName}
              onChangeText={setAddTaskName}
              placeholder="What needs doing?"
              placeholderTextColor={colors.textPlaceholder}
              autoFocus
            />
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeBtn, addTaskMode === "timed" && styles.modeBtnActive]}
                onPress={() => setAddTaskMode("timed")}
              >
                <Text
                  style={[
                    styles.modeBtnText,
                    addTaskMode === "timed" && styles.modeBtnTextActive,
                  ]}
                >
                  Timed
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, addTaskMode === "anytime" && styles.modeBtnActive]}
                onPress={() => setAddTaskMode("anytime")}
              >
                <Text
                  style={[
                    styles.modeBtnText,
                    addTaskMode === "anytime" && styles.modeBtnTextActive,
                  ]}
                >
                  Anytime today
                </Text>
              </TouchableOpacity>
            </View>
            {addTaskMode === "timed" ? (
              <View style={styles.timeFields}>
                <TimeField label="Start" value={addTaskStart} onChange={setAddTaskStart} />
                <TimeField label="End" value={addTaskEnd} onChange={setAddTaskEnd} />
              </View>
            ) : (
              <Text style={styles.anytimeHelper}>
                Good for quick things under 30 min
              </Text>
            )}
            <TouchableOpacity
              style={[styles.addTaskConfirmBtn, !addTaskName.trim() && styles.addTaskConfirmDisabled]}
              onPress={handleAddTask}
              disabled={!addTaskName.trim() || saving}
            >
              <Text style={styles.addTaskConfirmText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={closeAddTask} disabled={saving}>
              <Text style={styles.addTaskCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

export default function TodayScreen() {
  return (
    <RequireAuth>
      <TodayScreenContent />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, position: "relative" },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  header: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.round,
    backgroundColor: colors.primaryDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.primary, ...typography.bodyBold },
  title: { fontSize: 28, fontWeight: "700", color: colors.text },
  date: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },
  headerActions: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md },
  link: { color: colors.primary, fontSize: 14 },
  linkDanger: { color: colors.danger, fontSize: 14 },
  list: { padding: spacing.lg, paddingBottom: 100 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  empty: { color: colors.textFaint, textAlign: "center", marginTop: 40, lineHeight: 22 },
  addAdhocBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  addAdhocPlus: {
    color: colors.danger,
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 22,
  },
  addAdhocLabel: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "500",
  },
  anytimeTray: {
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceDim,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  anytimeTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  addTaskSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.pill,
    borderTopRightRadius: radii.pill,
    marginTop: "auto",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    gap: spacing.md,
  },
  addTaskTitle: { color: colors.text, ...typography.heading },
  addTaskInput: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  modeToggle: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modeBtn: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  modeBtnTextActive: {
    color: colors.onPrimary,
  },
  timeFields: {
    gap: spacing.md,
  },
  anytimeHelper: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  addTaskConfirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  addTaskConfirmDisabled: {
    opacity: 0.5,
  },
  addTaskConfirmText: { color: colors.onPrimary, ...typography.bodyBold },
  addTaskCancelText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    paddingVertical: spacing.sm,
  },
  toast: {
    position: "absolute",
    bottom: 40,
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.streak,
  },
  toastText: { color: colors.text, fontSize: 14 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  overlayDismiss: {
    flex: 1,
  },
  undoSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.pill,
    borderTopRightRadius: radii.pill,
    marginTop: "auto",
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  undoOption: {
    paddingVertical: 18,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    alignItems: "center",
  },
  undoOptionLast: { borderBottomWidth: 0 },
  undoOptionDestructive: { color: colors.danger, fontSize: 16, fontWeight: "600" },
  undoOptionCancel: { color: colors.textMuted, fontSize: 16, fontWeight: "500" },
  removeSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.pill,
    borderTopRightRadius: radii.pill,
    marginTop: "auto",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    gap: spacing.md,
  },
  removeTitle: { color: colors.text, ...typography.heading },
  removeBody: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },
  removeLabel: { color: colors.textMuted, ...typography.smallBold },
  removeInput: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 14,
    minHeight: 60,
  },
  removeConfirmBtn: {
    backgroundColor: colors.danger,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  removeConfirmText: { color: colors.onPrimary, ...typography.bodyBold },
  removeCancelText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    paddingVertical: spacing.sm,
  },
});
