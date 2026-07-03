import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
  Modal,
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
  DailyInstance,
} from "../src/types/database";
import { minutesToTime } from "../src/lib/time";
import { getInitials } from "../src/lib/format";
import { RequireAuth } from "../src/components/RequireAuth";
import { StreakStrip } from "../src/components/StreakStrip";
import { CheckInSheet } from "../src/components/CheckInSheet";
import { TaskDetailSheet } from "../src/components/TaskDetailSheet";
import { RecoverySheet, RecoveryAIContent } from "../src/components/RecoverySheet";
import { BlockCard } from "../src/components/BlockCard";
import { useTodayData } from "../src/hooks/useTodayData";
import { colors, spacing, radii, typography } from "../src/theme";

function TodayScreenContent() {
  const { session, signOut, psychologyProfile, profile } = useAuth();
  const { instances, displayDate, totalBlocks, stats, loading } = useTodayData(
    session?.user.id
  );
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
    const isFixed = (inst: DailyInstance) => inst.is_fixed || !!inst.block?.is_fixed;
    if (isFixed(instanceA) || isFixed(instanceB)) return;

    const durationA = instanceA.end_minutes - instanceA.start_minutes;
    const durationB = instanceB.end_minutes - instanceB.start_minutes;

    const [earlier, later] =
      instanceA.start_minutes < instanceB.start_minutes
        ? [instanceA, instanceB]
        : [instanceB, instanceA];

    const earlierDuration = earlier.end_minutes - earlier.start_minutes;
    const laterDuration = later.end_minutes - later.start_minutes;

    const newLaterStart = earlier.start_minutes;
    const newLaterEnd = newLaterStart + laterDuration;
    const newEarlierStart = newLaterEnd;
    const newEarlierEnd = newEarlierStart + earlierDuration;

    await supabase
      .from("daily_schedule_instances")
      .update({ start_minutes: newLaterStart, end_minutes: newLaterEnd })
      .eq("id", later.id);

    await supabase
      .from("daily_schedule_instances")
      .update({ start_minutes: newEarlierStart, end_minutes: newEarlierEnd })
      .eq("id", earlier.id);

    const updated = instances
      .map((inst) => {
        if (inst.id === later.id) {
          return { ...inst, start_minutes: newLaterStart, end_minutes: newLaterEnd };
        }
        if (inst.id === earlier.id) {
          return { ...inst, start_minutes: newEarlierStart, end_minutes: newEarlierEnd };
        }
        return inst;
      })
      .sort((a, b) => a.start_minutes - b.start_minutes);

    setTodayInstances(updated);

    showToast(
      `${later.block?.name ?? "Block"} swapped with ${earlier.block?.name ?? "block"}`
    );
    triggerFlash(earlier.id);
    triggerFlash(later.id);
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
          {sortedInstances.length === 0 ? (
            <Text style={styles.empty}>
              {totalBlocks > 0
                ? `Nothing scheduled for ${todayLabel}. Your blocks may be set for other days — go to Edit schedule and tap ${todayLabel} on each block.`
                : "No blocks yet. Add some in the schedule builder first."}
            </Text>
          ) : (
            sortedInstances.map((item) => (
              <BlockCard
                key={item.id}
                instance={item}
                saving={saving}
                cardPositions={cardPositions}
                onCheckIn={setCheckInInstance}
                onMarkMissed={handleMarkMissed}
                onUndo={showUndoActions}
                onTaskDetail={openTaskDetail}
                onSwap={handleSwap}
                onLayout={handleCardLayout}
                registerFlashTrigger={registerFlashTrigger}
                unregisterFlashTrigger={unregisterFlashTrigger}
              />
            ))
          )}
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
  list: { padding: spacing.lg, paddingBottom: 100 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  empty: { color: colors.textFaint, textAlign: "center", marginTop: 40, lineHeight: 22 },
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
});
