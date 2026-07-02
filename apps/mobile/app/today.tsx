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
  TextInput,
  Alert,
  Animated as RNAnimated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
  AppState,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { router } from "expo-router";
import { generateDailyInstances, supabase } from "../src/lib/supabase";
import { scheduleTodayBlockNotifications } from "../src/lib/blockNotifications";
import { findRescheduleSlot, getTodayLabel } from "../src/lib/schedule";
import { useAuth } from "../src/providers/AuthProvider";
import { useStore } from "../src/store";
import {
  BlockStatus,
  CompletionRating,
  DailyInstance,
} from "../src/types/database";
import { minutesToTime, getLocalDateString } from "../src/lib/time";
import { fetchTodayStats, TodayStats } from "../src/lib/stats";
import { RequireAuth } from "../src/components/RequireAuth";
import { colors, spacing, radii, typography } from "../src/theme";

const STATUS_COLORS: Record<BlockStatus, string> = {
  pending: colors.border,
  active: colors.border,
  completed: colors.success,
  missed: colors.danger,
  skipped: colors.textPlaceholder,
  rescheduled: colors.textPlaceholder,
};

const RATING_OPTIONS: { value: CompletionRating; label: string }[] = [
  { value: "crushed", label: "Crushed it" },
  { value: "partial", label: "Partly" },
  { value: "pulled_away", label: "Got pulled away" },
];

function getStatusColor(status: BlockStatus): string {
  return STATUS_COLORS[status] ?? STATUS_COLORS.pending;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface DraggableInstanceCardProps {
  item: DailyInstance;
  saving: boolean;
  onLongPress: () => void;
  onActionPress: () => void;
  onOpenTaskDetail: () => void;
  onCardLayout: (id: string, y: number, height: number) => void;
  onDragEnd: (draggedId: string, translationY: number) => void;
  registerFlashTrigger: (id: string, trigger: () => void) => void;
  unregisterFlashTrigger: (id: string) => void;
}

function DraggableInstanceCard({
  item,
  saving,
  onLongPress,
  onActionPress,
  onOpenTaskDetail,
  onCardLayout,
  onDragEnd,
  registerFlashTrigger,
  unregisterFlashTrigger,
}: DraggableInstanceCardProps) {
  const translateY = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const isDone = item.status === "completed";
  const isMissed = item.status === "missed";

  const triggerFlash = () => {
    flashOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 200 })
      ),
      5,
      false
    );
  };

  useEffect(() => {
    registerFlashTrigger(item.id, triggerFlash);
    return () => unregisterFlashTrigger(item.id);
  }, [item.id, registerFlashTrigger, unregisterFlashTrigger]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onUpdate((e) => {
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      translateY.value = withTiming(0, { duration: 150 });
      runOnJS(onDragEnd)(item.id, e.translationY);
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: translateY.value !== 0 ? 20 : 1,
    elevation: translateY.value !== 0 ? 8 : 0,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.streak,
  }));

  return (
    <Animated.View
      style={[styles.card, animatedCardStyle]}
      onLayout={(e) => {
        const { y, height } = e.nativeEvent.layout;
        onCardLayout(item.id, y, height);
      }}
    >
      <Pressable
        style={styles.cardInner}
        onLongPress={onLongPress}
        delayLongPress={450}
      >
        <GestureDetector gesture={panGesture}>
          <View style={styles.dragHandle} hitSlop={12}>
            <Text style={styles.dragLines}>≡</Text>
          </View>
        </GestureDetector>
        <View
          style={[styles.statusBar, { backgroundColor: getStatusColor(item.status) }]}
        />
        <View style={styles.cardBody}>
          <View style={styles.cardMain}>
            <Text style={styles.blockName}>{item.block?.name ?? "Block"}</Text>
            <Text style={styles.meta}>
              {minutesToTime(item.start_minutes)} – {minutesToTime(item.end_minutes)}
            </Text>
            <TouchableOpacity onPress={onOpenTaskDetail} hitSlop={8}>
              {item.task_detail ? (
                <Text style={styles.task}>{item.task_detail}</Text>
              ) : (
                <Text style={styles.taskAdd}>Add task →</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.actionCircle,
              isDone && styles.actionCircleDone,
              isMissed && styles.actionCircleMissed,
            ]}
            onPress={onActionPress}
            disabled={item.status === "skipped" || saving}
            hitSlop={8}
          >
            {isDone ? (
              <Text style={styles.actionCircleCheck}>✓</Text>
            ) : isMissed ? (
              <Text style={styles.actionCircleMissedIcon}>!</Text>
            ) : null}
          </TouchableOpacity>
        </View>
      </Pressable>
      <Animated.View style={flashStyle} pointerEvents="none" />
    </Animated.View>
  );
}

function TodayScreenContent() {
  const { session, signOut, psychologyProfile, profile } = useAuth();
  const { todayInstances, setTodayInstances, updateInstance } = useStore();
  const [loading, setLoading] = useState(true);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [checkInInstance, setCheckInInstance] = useState<DailyInstance | null>(null);
  const [undoInstance, setUndoInstance] = useState<DailyInstance | null>(null);
  const [recoveryInstance, setRecoveryInstance] = useState<DailyInstance | null>(null);
  const [recoveryAI, setRecoveryAI] = useState<{
    acknowledgment: string;
    reflection_prompt_why: string;
    reflection_prompt_improve: string;
    pattern_note: string | null;
  } | null>(null);
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
  const [displayDate, setDisplayDate] = useState(getLocalDateString());
  const currentDateRef = useRef(getLocalDateString());
  const [stats, setStats] = useState<TodayStats | null>(null);
  const todayLabel = getTodayLabel();

  const sortedInstances = [...todayInstances].sort(
    (a, b) => a.start_minutes - b.start_minutes
  );

  const loadToday = useCallback(
    async (dateOverride?: string) => {
      if (!session?.user.id) return;

      const targetDate = dateOverride ?? getLocalDateString();
      setDisplayDate(targetDate);
      currentDateRef.current = targetDate;
      setLoading(true);

      await generateDailyInstances(targetDate);

      const { count } = await supabase
        .from("schedule_blocks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id);

      setTotalBlocks(count ?? 0);

      const { data, error } = await supabase
        .from("daily_schedule_instances")
        .select("*, block:schedule_blocks(*)")
        .eq("user_id", session.user.id)
        .eq("date", targetDate)
        .order("start_minutes");

      if (error) {
        console.error(error);
      } else {
        setTodayInstances(data ?? []);
        if (data?.length) {
          scheduleTodayBlockNotifications(data, targetDate).catch(console.error);
        }
        fetchTodayStats(session.user.id)
          .then(setStats)
          .catch(console.error);
      }
      setLoading(false);
    },
    [session?.user.id, setTodayInstances]
  );

  useEffect(() => {
    loadToday();
  }, [session?.user.id, loadToday]);

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

  const findSwapTarget = useCallback(
    (draggedId: string, translationY: number): DailyInstance | null => {
      const dragged = cardPositions.current[draggedId];
      if (!dragged) return null;

      const draggedCenterY = dragged.y + dragged.height / 2 + translationY;
      const instances = [...useStore.getState().todayInstances].sort(
        (a, b) => a.start_minutes - b.start_minutes
      );

      for (const instance of instances) {
        if (instance.id === draggedId) continue;
        const pos = cardPositions.current[instance.id];
        if (!pos) continue;
        if (draggedCenterY >= pos.y && draggedCenterY <= pos.y + pos.height) {
          return instance;
        }
      }
      return null;
    },
    []
  );

  const handleSwap = async (instanceA: DailyInstance, instanceB: DailyInstance) => {
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

    const updated = todayInstances
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

  const handleDragEnd = async (draggedId: string, translationY: number) => {
    const swapTarget = findSwapTarget(draggedId, translationY);
    if (!swapTarget) return;

    const instanceA = useStore.getState().todayInstances.find((i) => i.id === draggedId);
    if (!instanceA) return;

    await handleSwap(instanceA, swapTarget);
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

  const handleActionPress = (item: DailyInstance) => {
    if (item.status === "skipped") return;

    if (item.status === "completed" || item.status === "missed") {
      showUndoActions(item);
      return;
    }

    setCheckInInstance(item);
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
      const message = err instanceof Error ? err.message : "Could not undo completion";
      if (Platform.OS === "web") console.error(message);
      else Alert.alert("Error", message);
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
      const message = err instanceof Error ? err.message : "Could not undo missed";
      if (Platform.OS === "web") console.error(message);
      else Alert.alert("Error", message);
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
        console.error("Recovery AI error:", err);
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
      const message = err instanceof Error ? err.message : "Could not mark missed";
      if (Platform.OS === "web") console.error(message);
      else Alert.alert("Error", message);
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
      const message = err instanceof Error ? err.message : "Could not save reflection";
      if (Platform.OS === "web") console.error(message);
      else Alert.alert("Error", message);
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
      console.error("Reschedule error:", error);
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
      todayInstances
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
      const message = err instanceof Error ? err.message : "Could not save check-in";
      if (Platform.OS === "web") console.error(message);
      else Alert.alert("Error", message);
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
      const message = err instanceof Error ? err.message : "Could not save task detail";
      if (Platform.OS === "web") console.error(message);
      else Alert.alert("Error", message);
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
          {stats ? (
            <View style={styles.streakContainer}>
              <View style={styles.streakHeader}>
                <Text style={styles.streakLabel}>
                  {stats.streak > 0
                    ? `🔥 ${stats.streak}-day streak`
                    : "Start your streak today"}
                </Text>
                <Text style={styles.streakSub}>{stats.completionRate}% this week</Text>
              </View>
              <View style={styles.weekStrip}>
                {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => {
                  const todayIndex =
                    new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
                  const isToday = i === todayIndex;
                  const isDone = stats.weekDayCompletions[i];
                  const isFuture = i > todayIndex;

                  return (
                    <View
                      key={i}
                      style={[
                        styles.daySquare,
                        isDone && styles.daySquareDone,
                        isToday && !isDone && styles.daySquareToday,
                        isFuture && styles.daySquareFuture,
                      ]}
                    >
                      <Text
                        style={[
                          styles.daySquareLetter,
                          isDone && styles.daySquareLetterDone,
                          isFuture && styles.daySquareLetterFuture,
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
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
              <DraggableInstanceCard
                key={item.id}
                item={item}
                saving={saving}
                onLongPress={() => handleMarkMissed(item)}
                onActionPress={() => handleActionPress(item)}
                onOpenTaskDetail={() => openTaskDetail(item)}
                onCardLayout={handleCardLayout}
                onDragEnd={handleDragEnd}
                registerFlashTrigger={registerFlashTrigger}
                unregisterFlashTrigger={unregisterFlashTrigger}
              />
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={!!recoveryInstance}
        transparent
        animationType="slide"
        onRequestClose={closeRecovery}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.recoverySheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.recoveryTitle}>
              {recoveryInstance?.block?.name ?? "Block"} — missed
            </Text>

            {recoveryLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
            ) : (
              <>
                <Text style={styles.recoveryAck}>{recoveryAI?.acknowledgment}</Text>
                {recoveryAI?.pattern_note ? (
                  <View style={styles.patternNote}>
                    <Text style={styles.patternNoteText}>{recoveryAI.pattern_note}</Text>
                  </View>
                ) : null}
              </>
            )}

            <Text style={styles.reflectionLabel}>
              {recoveryAI?.reflection_prompt_why ?? "What got in the way?"}
            </Text>
            <TextInput
              style={styles.reflectionInput}
              value={reflectionWhy}
              onChangeText={setReflectionWhy}
              placeholder="Be honest..."
              placeholderTextColor={colors.textPlaceholder}
              multiline
            />

            <Text style={styles.reflectionLabel}>
              {recoveryAI?.reflection_prompt_improve ?? "One thing you'd change next time?"}
            </Text>
            <TextInput
              style={styles.reflectionInput}
              value={reflectionImprove}
              onChangeText={setReflectionImprove}
              placeholder="Even something small..."
              placeholderTextColor={colors.textPlaceholder}
              multiline
            />

            {rescheduleSlot ? (
              <View style={styles.rescheduleBox}>
                <Text style={styles.rescheduleLabel}>Available slot today</Text>
                <Text style={styles.rescheduleTime}>
                  {minutesToTime(rescheduleSlot.start_minutes)} —{" "}
                  {minutesToTime(rescheduleSlot.end_minutes)}
                </Text>
                <TouchableOpacity
                  style={styles.rescheduleBtn}
                  onPress={handleReschedule}
                  disabled={saving}
                >
                  <Text style={styles.rescheduleBtnText}>Reschedule to this slot</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.noSlot}>No open slots remaining today.</Text>
            )}

            <View style={styles.recoveryActions}>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                onPress={handleSaveRecovery}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>Save reflection</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={closeRecovery} disabled={saving}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {toastMessage ? (
        <Animated.View style={[styles.toast, toastAnimatedStyle]} pointerEvents="none">
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      ) : null}

      <Modal
        visible={!!checkInInstance}
        transparent
        animationType="fade"
        onRequestClose={closeCheckIn}
      >
        <Pressable style={styles.overlay} onPress={closeCheckIn}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <RNAnimated.View
              style={[styles.sheet, { transform: [{ translateY: checkInSlideAnim }] }]}
            >
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>
                {checkInInstance?.block?.name ?? "Block"} — how'd it go?
              </Text>
              {checkInInstance ? (
                <Text style={styles.sheetTime}>
                  {minutesToTime(checkInInstance.start_minutes)} –{" "}
                  {minutesToTime(checkInInstance.end_minutes)}
                </Text>
              ) : null}

              <View style={styles.ratingRow}>
                {RATING_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={({ pressed }) => [
                      styles.ratingBtn,
                      pressed && styles.ratingBtnActive,
                    ]}
                    onPress={() => handleCheckIn(opt.value)}
                    disabled={saving}
                  >
                    <Text style={styles.ratingBtnText}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>

              {saving ? (
                <ActivityIndicator color={colors.primary} style={styles.sheetSaving} />
              ) : null}
            </RNAnimated.View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!activeTaskDetailInstance}
        transparent
        animationType="fade"
        onRequestClose={closeTaskDetail}
      >
        <KeyboardAvoidingView style={styles.overlay} behavior="padding">
          <Pressable style={styles.overlayDismiss} onPress={closeTaskDetail} />
          <RNAnimated.View
            style={[styles.taskSheet, { transform: [{ translateY: taskSlideAnim }] }]}
          >
            <View style={styles.taskSheetHeader}>
              <View style={styles.taskSheetHeaderText}>
                <Text style={styles.sheetTitle}>
                  {activeTaskDetailInstance?.block?.name ?? "Block"}
                </Text>
                <Text style={styles.taskSheetSubtitle}>What will you actually do?</Text>
              </View>
              <TouchableOpacity onPress={closeTaskDetail} hitSlop={8}>
                <Text style={styles.taskSheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.taskDetailInput}
              value={taskDetailDraft}
              onChangeText={setTaskDetailDraft}
              placeholder="e.g. Chest day + 20 min run"
              placeholderTextColor={colors.textPlaceholder}
              autoFocus
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.taskSaveBtn, saving && styles.btnDisabled]}
              onPress={saveTaskDetail}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.taskSaveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </RNAnimated.View>
        </KeyboardAvoidingView>
      </Modal>

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
  streakContainer: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.streakHousing,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 0.5,
    borderColor: colors.streakBorder,
  },
  streakHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  streakLabel: {
    color: colors.streak,
    ...typography.smallBold,
  },
  streakSub: {
    color: colors.streakMuted,
    ...typography.caption,
  },
  weekStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  daySquare: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.streakBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  daySquareDone: {
    backgroundColor: colors.streak,
  },
  daySquareToday: {
    backgroundColor: colors.streakBorder,
    borderWidth: 1.5,
    borderColor: colors.streak,
  },
  daySquareFuture: {
    backgroundColor: colors.streakSquare,
  },
  daySquareLetter: {
    color: colors.streakMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  daySquareLetterDone: {
    color: colors.text,
  },
  daySquareLetterFuture: {
    color: colors.streakMuted,
  },
  list: { padding: spacing.lg, paddingBottom: 100 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: 10,
    position: "relative",
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    borderRadius: radii.lg,
  },
  dragHandle: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  dragLines: { color: colors.textDisabled, fontSize: 18, lineHeight: 20 },
  statusBar: { width: 4 },
  cardBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    paddingLeft: spacing.sm,
    gap: spacing.md,
  },
  cardMain: { flex: 1 },
  blockName: { color: colors.text, fontSize: 16, fontWeight: "600" },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
  task: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.sm },
  taskAdd: { color: colors.primary, fontSize: 13, marginTop: spacing.sm, fontWeight: "500" },
  actionCircle: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  actionCircleDone: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  actionCircleMissed: {
    borderColor: colors.danger,
    backgroundColor: "transparent",
  },
  actionCircleCheck: { color: colors.text, fontSize: 16, fontWeight: "700" },
  actionCircleMissedIcon: { color: colors.danger, fontSize: 16, fontWeight: "700" },
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
  overlayDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.pill,
    borderTopRightRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textDisabled,
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  sheetTime: { color: colors.textMuted, fontSize: 14, marginBottom: spacing.xl, marginTop: 6 },
  ratingRow: { flexDirection: "row", gap: spacing.sm },
  ratingBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  ratingBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ratingBtnText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  sheetSaving: { marginTop: spacing.lg },
  taskSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.pill,
    borderTopRightRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingTop: spacing.lg,
  },
  taskSheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  taskSheetHeaderText: { flex: 1 },
  taskSheetSubtitle: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs },
  taskSheetClose: { color: colors.textMuted, fontSize: 20, lineHeight: 22 },
  taskDetailInput: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
    minHeight: 88,
    maxHeight: 88,
  },
  taskSaveBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  taskSaveBtnText: { color: colors.onPrimary, ...typography.bodyBold },
  btnDisabled: { opacity: 0.5 },
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  recoverySheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.round,
    padding: spacing.xl,
    paddingBottom: 40,
    gap: spacing.md,
  },
  recoveryTitle: { color: colors.danger, ...typography.heading },
  recoveryAck: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  patternNote: {
    backgroundColor: colors.dangerTint,
    borderLeftWidth: 2,
    borderLeftColor: colors.danger,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  patternNoteText: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  reflectionLabel: { color: colors.textMuted, ...typography.smallBold },
  reflectionInput: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    minHeight: 60,
  },
  rescheduleBox: {
    backgroundColor: colors.successTint,
    borderRadius: radii.md,
    padding: 14,
    gap: 6,
  },
  rescheduleLabel: { color: colors.success, fontSize: 12, fontWeight: "600" },
  rescheduleTime: { color: colors.text, ...typography.bodyBold },
  rescheduleBtn: {
    backgroundColor: colors.success,
    borderRadius: radii.sm,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  rescheduleBtnText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  noSlot: { color: colors.textPlaceholder, fontSize: 13, fontStyle: "italic" },
  recoveryActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  saveBtnText: { color: colors.onPrimary, ...typography.bodyBold },
  skipText: { color: colors.textPlaceholder, fontSize: 14 },
});
