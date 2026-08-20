import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Animated as RNAnimated,
  Easing,
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
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { minutesToTime, getLocalDateString } from "../src/lib/time";
import { scheduleTodayBlockNotifications } from "../src/lib/blockNotifications";
import { getInitials } from "../src/lib/format";
import { RequireAuth } from "../src/components/RequireAuth";
import { BrandLoader } from "../src/components/BrandLoader";
import { StreakStrip } from "../src/components/StreakStrip";
import { CheckInSheet } from "../src/components/CheckInSheet";
import { TaskDetailSheet } from "../src/components/TaskDetailSheet";
import { RecoverySheet } from "../src/components/RecoverySheet";
import { buildRecoveryCopy, findInsightForBlock, RecoveryCopy } from "../src/lib/recoveryCopy";
import { BlockCard } from "../src/components/BlockCard";
import { DayBoundaryCard } from "../src/components/DayBoundaryCard";
import { InsightCard } from "../src/components/InsightCard";
import { AdhocTimedCard } from "../src/components/AdhocTimedCard";
import { AdhocAnytimeRow } from "../src/components/AdhocAnytimeRow";
import { AdhocEditSheet } from "../src/components/AdhocEditSheet";
import { TimePicker } from "../src/components/TimePicker";
import { AppMenu, MenuButton } from "../src/components/AppMenu";
import { PressableScale } from "../src/components/PressableScale";
import { useTodayData } from "../src/hooks/useTodayData";
import { STREAK_THRESHOLD } from "../src/lib/stats";
import {
  hapticCommit,
  hapticMissed,
  hapticReject,
  hapticSelect,
} from "../src/lib/haptics";
import { useTheme } from "../src/providers/ThemeProvider";
import { Colors, spacing, radii, typography, numeric, iconSizes } from "../src/theme";

const BOTTOM_SHEET_OFFSET = 400;
const BOTTOM_SHEET_OPEN_DURATION = 220;
const BOTTOM_SHEET_CLOSE_DURATION = 180;
const BOTTOM_SHEET_SCRIM_OPACITY_LIGHT = 0.4;
const BOTTOM_SHEET_SCRIM_OPACITY_DARK = 0.6;

function openBottomSheet(
  slideAnim: RNAnimated.Value,
  scrimAnim: RNAnimated.Value,
  scrimOpacity: number
) {
  slideAnim.setValue(BOTTOM_SHEET_OFFSET);
  scrimAnim.setValue(0);
  RNAnimated.parallel([
    RNAnimated.timing(slideAnim, {
      toValue: 0,
      duration: BOTTOM_SHEET_OPEN_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
    RNAnimated.timing(scrimAnim, {
      toValue: scrimOpacity,
      duration: BOTTOM_SHEET_OPEN_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
  ]).start();
}

function closeBottomSheet(
  slideAnim: RNAnimated.Value,
  scrimAnim: RNAnimated.Value,
  onClosed?: () => void
) {
  RNAnimated.parallel([
    RNAnimated.timing(slideAnim, {
      toValue: BOTTOM_SHEET_OFFSET,
      duration: BOTTOM_SHEET_CLOSE_DURATION,
      useNativeDriver: true,
    }),
    RNAnimated.timing(scrimAnim, {
      toValue: 0,
      duration: BOTTOM_SHEET_CLOSE_DURATION,
      useNativeDriver: true,
    }),
  ]).start(() => onClosed?.());
}

function TodayScreenContent() {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session, psychologyProfile, profile } = useAuth();
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
    removeAdhocTask,
    restoreAdhocTask,
    insights,
  } = useTodayData(session?.user.id);
  const { setTodayInstances, updateInstance } = useStore();
  const [checkInInstance, setCheckInInstance] = useState<DailyInstance | null>(null);
  const [undoInstance, setUndoInstance] = useState<DailyInstance | null>(null);
  const [recoveryInstance, setRecoveryInstance] = useState<DailyInstance | null>(null);
  const [recoveryCopy, setRecoveryCopy] = useState<RecoveryCopy | null>(null);
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
  const [addTaskStartMinutes, setAddTaskStartMinutes] = useState(9 * 60);
  const [addTaskEndMinutes, setAddTaskEndMinutes] = useState(9 * 60 + 30);
  const [editAdhocTask, setEditAdhocTask] = useState<AdhocTask | null>(null);
  const [editAdhocName, setEditAdhocName] = useState("");
  const [editAdhocStartMinutes, setEditAdhocStartMinutes] = useState(9 * 60);
  const [editAdhocEndMinutes, setEditAdhocEndMinutes] = useState(9 * 60 + 30);
  const [menuOpen, setMenuOpen] = useState(false);
  const [boundaryPrompt, setBoundaryPrompt] = useState<{
    sleptAt: number | null;
    wokeAt: number | null;
  } | null>(null);
  const [boundaryDismissed, setBoundaryDismissed] = useState(true);
  const [insightDismissed, setInsightDismissed] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const checkInSlideAnim = useRef(new RNAnimated.Value(400)).current;
  const taskSlideAnim = useRef(new RNAnimated.Value(400)).current;
  const undoSlideAnim = useRef(new RNAnimated.Value(BOTTOM_SHEET_OFFSET)).current;
  const undoScrimAnim = useRef(new RNAnimated.Value(0)).current;
  const removeSlideAnim = useRef(new RNAnimated.Value(BOTTOM_SHEET_OFFSET)).current;
  const removeScrimAnim = useRef(new RNAnimated.Value(0)).current;
  const addTaskSlideAnim = useRef(new RNAnimated.Value(BOTTOM_SHEET_OFFSET)).current;
  const addTaskScrimAnim = useRef(new RNAnimated.Value(0)).current;
  const editAdhocSlideAnim = useRef(new RNAnimated.Value(BOTTOM_SHEET_OFFSET)).current;
  const editAdhocScrimAnim = useRef(new RNAnimated.Value(0)).current;
  const bottomSheetScrimOpacity =
    scheme === "dark" ? BOTTOM_SHEET_SCRIM_OPACITY_DARK : BOTTOM_SHEET_SCRIM_OPACITY_LIGHT;
  const toastOpacity = useSharedValue(0);
  const toastY = useSharedValue(60);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adhocToggleInFlight = useRef<Set<string>>(new Set());
  const cardPositions = useRef<Record<string, { y: number; height: number }>>({});
  const flashTriggers = useRef<Record<string, () => void>>({});
  const todayLabel = getTodayLabel();

  const sortedInstances = [...instances].sort(
    (a, b) => a.start_minutes - b.start_minutes
  );

  const morningInsight = useMemo(
    () =>
      insights
        .filter((i) => i.kind !== "strength")
        .filter((i) => {
          const age = Date.now() - new Date(i.generated_at).getTime();
          return age < 8 * 24 * 60 * 60 * 1000;
        })
        .sort((a, b) => a.rank - b.rank)[0] ?? null,
    [insights]
  );

  const todayCompletionRatio = useMemo(() => {
    const relevant = instances.filter(
      (i) => i.status !== "removed" && i.status !== "rescheduled"
    );
    if (relevant.length === 0) return 0;
    return relevant.filter((i) => i.status === "completed").length / relevant.length;
  }, [instances]);

  const todayMissedRatio = useMemo(() => {
    const relevant = instances.filter(
      (i) => i.status !== "removed" && i.status !== "rescheduled"
    );
    if (relevant.length === 0) return 0;
    return relevant.filter((i) => i.status === "missed").length / relevant.length;
  }, [instances]);

  const liveCompletionRate = useMemo(() => {
    if (!stats) return 0;
    const relevant = instances.filter(
      (i) =>
        i.status !== "skipped" &&
        i.status !== "rescheduled" &&
        i.status !== "removed"
    );
    const liveCompleted = relevant.filter((i) => i.status === "completed").length;

    const weekCompleted = stats.completedCount - stats.todayCompleted + liveCompleted;
    const weekTotal = stats.totalCount - stats.todayTotal + relevant.length;

    return weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;
  }, [instances, stats]);

  const liveStreak = useMemo(() => {
    if (!stats) return 0;
    const relevant = instances.filter(
      (i) => i.status !== "removed" && i.status !== "rescheduled"
    );
    if (relevant.length === 0) return stats.streak;

    const accounted = relevant.filter((i) =>
      ["completed", "missed", "skipped"].includes(i.status)
    ).length;
    const meetsThreshold = accounted / relevant.length >= STREAK_THRESHOLD;

    // The fetched streak may already include today. Only adjust for the
    // difference between the fetched state and the live state — a naive +1
    // would double-count.
    if (meetsThreshold && !stats.todayCountedInStreak) return stats.streak + 1;
    if (!meetsThreshold && stats.todayCountedInStreak) return stats.streak - 1;
    return stats.streak;
  }, [instances, stats]);

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
    if (!session?.user.id) return;

    const today = getLocalDateString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = getLocalDateString(yesterdayDate);
    const dismissKey = `boundary_dismissed_${today}`;

    (async () => {
      const dismissed = await AsyncStorage.getItem(dismissKey);
      if (dismissed) {
        setBoundaryDismissed(true);
        setBoundaryPrompt(null);
        return;
      }

      setBoundaryDismissed(false);

      const { data: logs, error } = await supabase
        .from("day_log")
        .select("date, slept_at, woke_at")
        .eq("user_id", session.user.id)
        .in("date", [yesterday, today]);

      if (error) {
        handleError(error, "loadDayBoundaries");
        return;
      }

      const yesterdayLog = logs?.find((l) => l.date === yesterday);
      const todayLog = logs?.find((l) => l.date === today);
      const needsSleep = yesterdayLog?.slept_at == null;
      const needsWake = todayLog?.woke_at == null;

      if (!needsSleep && !needsWake) {
        setBoundaryPrompt(null);
        return;
      }

      setBoundaryPrompt({
        sleptAt: yesterdayLog?.slept_at ?? null,
        wokeAt: todayLog?.woke_at ?? null,
      });
    })();
  }, [session?.user.id]);

  useEffect(() => {
    if (!morningInsight) return;
    setInsightDismissed(true);
    const dismissKey = `insight_seen_${morningInsight.id}`;
    AsyncStorage.getItem(dismissKey).then((val) => {
      setInsightDismissed(!!val);
    });
  }, [morningInsight?.id]);

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

  useEffect(() => {
    if (undoInstance) {
      openBottomSheet(undoSlideAnim, undoScrimAnim, bottomSheetScrimOpacity);
    }
  }, [undoInstance, undoSlideAnim, undoScrimAnim, bottomSheetScrimOpacity]);

  useEffect(() => {
    if (removeInstance) {
      openBottomSheet(removeSlideAnim, removeScrimAnim, bottomSheetScrimOpacity);
    }
  }, [removeInstance, removeSlideAnim, removeScrimAnim, bottomSheetScrimOpacity]);

  useEffect(() => {
    if (addTaskOpen) {
      openBottomSheet(addTaskSlideAnim, addTaskScrimAnim, bottomSheetScrimOpacity);
    }
  }, [addTaskOpen, addTaskSlideAnim, addTaskScrimAnim, bottomSheetScrimOpacity]);

  useEffect(() => {
    if (editAdhocTask) {
      openBottomSheet(editAdhocSlideAnim, editAdhocScrimAnim, bottomSheetScrimOpacity);
    }
  }, [editAdhocTask, editAdhocSlideAnim, editAdhocScrimAnim, bottomSheetScrimOpacity]);

  const closeUndoSheet = useCallback((onClosed?: () => void) => {
    closeBottomSheet(undoSlideAnim, undoScrimAnim, () => {
      setUndoInstance(null);
      onClosed?.();
    });
  }, [undoSlideAnim, undoScrimAnim]);

  const closeRemoveSheet = useCallback((onClosed?: () => void) => {
    closeBottomSheet(removeSlideAnim, removeScrimAnim, () => {
      setRemoveInstance(null);
      setRemoveReason("");
      onClosed?.();
    });
  }, [removeSlideAnim, removeScrimAnim]);

  const closeAddTask = useCallback((onClosed?: () => void) => {
    closeBottomSheet(addTaskSlideAnim, addTaskScrimAnim, () => {
      setAddTaskOpen(false);
      setAddTaskName("");
      setAddTaskMode("timed");
      setAddTaskStartMinutes(9 * 60);
      setAddTaskEndMinutes(9 * 60 + 30);
      onClosed?.();
    });
  }, [addTaskSlideAnim, addTaskScrimAnim]);

  const closeEditAdhoc = useCallback((onClosed?: () => void) => {
    closeBottomSheet(editAdhocSlideAnim, editAdhocScrimAnim, () => {
      setEditAdhocTask(null);
      setEditAdhocName("");
      setEditAdhocStartMinutes(9 * 60);
      setEditAdhocEndMinutes(9 * 60 + 30);
      onClosed?.();
    });
  }, [editAdhocSlideAnim, editAdhocScrimAnim]);

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

  const resyncNotifications = (updatedInstances: DailyInstance[]) => {
    scheduleTodayBlockNotifications(updatedInstances, getLocalDateString()).catch((err) =>
      handleError(err, "resyncNotifications")
    );
  };

  const handleSwap = async (instanceA: DailyInstance, instanceB: DailyInstance) => {
    if (instanceA.is_fixed || instanceA.block?.is_fixed) return;
    if (instanceB.is_fixed || instanceB.block?.is_fixed) return;

    const [earlier, later] =
      instanceA.start_minutes < instanceB.start_minutes
        ? [instanceA, instanceB]
        : [instanceB, instanceA];

    const earlierDuration = earlier.end_minutes - earlier.start_minutes;
    const laterDuration = later.end_minutes - later.start_minutes;
    const gap = later.start_minutes - earlier.end_minutes;

    const anchor = earlier.start_minutes;
    const laterNewStart = anchor;
    const laterNewEnd = laterNewStart + laterDuration;
    const earlierNewStart = laterNewEnd + gap;
    const earlierNewEnd = earlierNewStart + earlierDuration;

    let newAStart: number;
    let newAEnd: number;
    let newBStart: number;
    let newBEnd: number;

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

    if (newAStart < 0 || newAEnd > 1440 || newBStart < 0 || newBEnd > 1440) {
      showToast("Can't swap — that wouldn't fit in the day");
      return;
    }

    const otherBlocks = instances.filter(
      (inst) =>
        inst.id !== instanceA.id &&
        inst.id !== instanceB.id &&
        inst.status !== "skipped" &&
        inst.status !== "removed"
    );
    const collides = (start: number, end: number, other: DailyInstance) =>
      start < other.end_minutes && end > other.start_minutes;

    const conflict = otherBlocks.find(
      (other) =>
        collides(newAStart, newAEnd, other) || collides(newBStart, newBEnd, other)
    );
    if (conflict) {
      hapticReject();
      showToast(`Can't swap — would overlap ${conflict.block?.name ?? "another block"}`);
      return;
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

    hapticCommit();

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
    resyncNotifications(updated);

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
      hapticCommit();
      updateInstance(removeInstance.id, {
        status: "removed",
        removed_reason: removeReason.trim() || null,
      });
      setTodayInstances(instances.filter((i) => i.id !== removeInstance.id));
      showToast(`${removeInstance.block?.name ?? "Block"} removed from today`);
    } catch (err) {
      handleError(err, "handleRemove", "Could not remove the block");
    } finally {
      closeRemoveSheet();
    }
  };

  const openAddTask = () => {
    setAddTaskName("");
    setAddTaskMode("timed");
    setAddTaskStartMinutes(9 * 60);
    setAddTaskEndMinutes(9 * 60 + 30);
    setAddTaskOpen(true);
  };

  const handleAddTask = async () => {
    const name = addTaskName.trim();
    if (!name || !session?.user.id) return;

    let start_minutes: number | null = null;
    let end_minutes: number | null = null;

    if (addTaskMode === "timed") {
      start_minutes = addTaskStartMinutes;
      end_minutes = addTaskEndMinutes;
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
    hapticSelect();
    if (adhocToggleInFlight.current.has(task.id)) return;

    adhocToggleInFlight.current.add(task.id);
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
      handleError(err, "toggleAdhocComplete");
      showToast("Couldn't update — check your connection");
    } finally {
      adhocToggleInFlight.current.delete(task.id);
    }
  };

  const openEditAdhoc = (task: AdhocTask) => {
    setEditAdhocName(task.name);
    setEditAdhocStartMinutes(task.start_minutes ?? 9 * 60);
    setEditAdhocEndMinutes(task.end_minutes ?? task.start_minutes! + 30);
    setEditAdhocTask(task);
  };

  const handleSaveEditAdhoc = async () => {
    if (!editAdhocTask || !editAdhocName.trim()) return;

    const isTimed = editAdhocTask.start_minutes != null;
    if (isTimed && editAdhocEndMinutes <= editAdhocStartMinutes) {
      Alert.alert("Invalid time", "End time must be after start time.");
      return;
    }

    const patch: Partial<AdhocTask> = { name: editAdhocName.trim() };
    if (isTimed) {
      patch.start_minutes = editAdhocStartMinutes;
      patch.end_minutes = editAdhocEndMinutes;
    }

    const previous = { ...editAdhocTask };
    updateAdhocTask(editAdhocTask.id, patch);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("adhoc_tasks")
        .update(patch)
        .eq("id", editAdhocTask.id);
      if (error) throw error;
      closeEditAdhoc();
      showToast("Task updated");
    } catch (err) {
      updateAdhocTask(editAdhocTask.id, previous);
      handleError(err, "handleSaveEditAdhoc");
      showToast("Couldn't save — check your connection");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAdhoc = async (task: AdhocTask) => {
    removeAdhocTask(task.id);
    try {
      const { error } = await supabase.from("adhoc_tasks").delete().eq("id", task.id);
      if (error) throw error;
      showToast(`"${task.name}" deleted`);
    } catch (err) {
      restoreAdhocTask(task);
      handleError(err, "handleDeleteAdhoc");
      showToast("Could not delete task");
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
    hapticMissed();

    const slot = findRescheduleSlot(
      { ...instance, status: "missed" },
      useStore.getState().todayInstances,
      profile?.sleep_target_minutes ?? null
    );
    setRescheduleSlot(slot);

    const { data: recent } = await supabase
      .from("daily_schedule_instances")
      .select("date, status")
      .eq("block_id", instance.block_id)
      .order("date", { ascending: false })
      .limit(14);

    // Separate, wider lookup: the user's most recent forward-looking note on
    // this block, however long ago. The 14-row streak window is far too narrow
    // — intentions are written rarely (~1 in 3 misses) and stay relevant.
    const { data: lastNoteRow } = await supabase
      .from("daily_schedule_instances")
      .select("date, reflection_why, reflection_improve")
      .eq("user_id", session!.user.id)
      .eq("block_id", instance.block_id)
      .neq("id", instance.id)
      .or("reflection_why.not.is.null,reflection_improve.not.is.null")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Prefer the forward-looking note; fall back to the cause. Both are the
    // user's own words, which is what makes this land.
    const noteText =
      lastNoteRow?.reflection_improve?.trim() ||
      lastNoteRow?.reflection_why?.trim() ||
      null;

    const copy = buildRecoveryCopy(
      instance.block?.name ?? "this block",
      recent ?? [],
      getLocalDateString(),
      noteText ? { text: noteText, date: lastNoteRow!.date } : null
    );
    const insight = copy.suppressInsight
      ? null
      : findInsightForBlock(insights, instance.block?.name ?? "");
    setRecoveryCopy({
      ...copy,
      structuralNote: insight?.belief ?? copy.structuralNote,
    });
    setRecoveryInstance(instance);
    setReflectionWhy("");
    setReflectionImprove("");
  };

  const closeRecovery = () => {
    setRecoveryInstance(null);
    setRecoveryCopy(null);
    setRescheduleSlot(null);
    setReflectionWhy("");
    setReflectionImprove("");
  };

  const handleSkipRecovery = async () => {
    if (!recoveryInstance) return;
    const instanceId = recoveryInstance.id;

    setSaving(true);
    try {
      await commitMissed(instanceId);
      closeRecovery();
    } catch (err) {
      handleError(err, "handleSkipRecovery", "Could not mark missed");
    } finally {
      setSaving(false);
    }
  };

  const commitMissed = async (instanceId: string, extra = {}) => {
    const { error } = await supabase
      .from("daily_schedule_instances")
      .update({ status: "missed", ...extra })
      .eq("id", instanceId);

    if (error) throw error;
    updateInstance(instanceId, { status: "missed", ...extra });
  };

  const handleSaveRecovery = async () => {
    if (!recoveryInstance) return;

    setSaving(true);
    try {
      await commitMissed(recoveryInstance.id, {
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

  const handleAdjustSlot = (start: number, end: number) => {
    setRescheduleSlot({ start_minutes: start, end_minutes: end });
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

    const updatedInstances = instances
      .map((i) => (i.id === recoveryInstance.id ? updated : i))
      .sort((a, b) => a.start_minutes - b.start_minutes);

    updateInstance(recoveryInstance.id, {
      start_minutes: rescheduleSlot.start_minutes,
      end_minutes: rescheduleSlot.end_minutes,
      status: "pending",
    });

    setTodayInstances(updatedInstances);
    resyncNotifications(updatedInstances);

    showToast(
      `${recoveryInstance.block?.name ?? "Block"} rescheduled to ${minutesToTime(rescheduleSlot.start_minutes)}`
    );
    setRecoveryInstance(null);
    setRecoveryCopy(null);
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
          miss_reason_tag: null,
        })
        .eq("id", checkInInstance.id);

      if (error) throw error;

      updateInstance(checkInInstance.id, {
        status: "completed",
        completion_rating: rating,
        miss_reason_tag: null,
      });
      closeCheckIn();
    } catch (err) {
      handleError(err, "handleCheckIn");
      showToast("Couldn't save — check your connection");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSleep = async (actualMinutes: number) => {
    if (!session?.user.id) return;

    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = getLocalDateString(yesterdayDate);

    setSaving(true);
    try {
      const { error } = await supabase
        .from("day_log")
        .upsert(
          { user_id: session.user.id, date: yesterday, slept_at: actualMinutes },
          { onConflict: "user_id,date" }
        );

      if (error) throw error;

      setBoundaryPrompt((prev) => {
        if (!prev) return null;
        const next = { ...prev, sleptAt: actualMinutes };
        if (next.wokeAt != null) return null;
        return next;
      });
    } catch (err) {
      handleError(err, "handleSaveSleep", "Could not save bedtime");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWake = async (wakeMinutes: number) => {
    if (!session?.user.id) return;

    const today = getLocalDateString();

    setSaving(true);
    try {
      const { error } = await supabase
        .from("day_log")
        .upsert(
          { user_id: session.user.id, date: today, woke_at: wakeMinutes },
          { onConflict: "user_id,date" }
        );

      if (error) throw error;

      setBoundaryPrompt((prev) => {
        if (!prev) return null;
        const next = { ...prev, wokeAt: wakeMinutes };
        if (next.sleptAt != null) return null;
        return next;
      });
    } catch (err) {
      handleError(err, "handleSaveWake", "Could not save wake time");
    } finally {
      setSaving(false);
    }
  };

  const handleDismissBoundary = async () => {
    await AsyncStorage.setItem(`boundary_dismissed_${getLocalDateString()}`, "1");
    setBoundaryDismissed(true);
    setBoundaryPrompt(null);
  };

  const handleDismissInsight = async () => {
    if (!morningInsight) return;
    await AsyncStorage.setItem(`insight_seen_${morningInsight.id}`, "1");
    setInsightDismissed(true);
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
        <BrandLoader size={56} />
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
            <View style={styles.headerRight}>
              <MenuButton onPress={() => setMenuOpen(true)} />
              <PressableScale
                style={styles.avatar}
                onPress={() => router.push("/account")}
              >
                <Text style={styles.avatarText}>
                  {getInitials(profile?.name ?? "U")}
                </Text>
              </PressableScale>
            </View>
          </View>
          {boundaryPrompt && !boundaryDismissed ? (
            <DayBoundaryCard
              sleepTargetMinutes={profile?.sleep_target_minutes ?? 22 * 60 + 30}
              wakeTargetMinutes={profile?.wake_target_minutes ?? 6 * 60}
              sleptAt={boundaryPrompt.sleptAt}
              wokeAt={boundaryPrompt.wokeAt}
              onSaveSleep={handleSaveSleep}
              onSaveWake={handleSaveWake}
              onDismiss={handleDismissBoundary}
              saving={saving}
            />
          ) : morningInsight && !insightDismissed ? (
            <InsightCard insight={morningInsight} onDismiss={handleDismissInsight} />
          ) : null}
          {stats ? (
            <StreakStrip
              stats={stats}
              todayCompletionRatio={todayCompletionRatio}
              todayMissedRatio={todayMissedRatio}
              liveCompletionRate={liveCompletionRate}
              liveStreak={liveStreak}
            />
          ) : null}
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
                  onDelete={handleDeleteAdhoc}
                  onEdit={openEditAdhoc}
                />
              )
            )
          )}

          <PressableScale style={styles.addAdhocPill} onPress={openAddTask}>
            <Text style={styles.addAdhocPlus}>+</Text>
          </PressableScale>

          {anytimeAdhoc.length > 0 ? (
            <View style={styles.anytimeTray}>
              <Text style={styles.anytimeTitle}>Anytime today</Text>
              {anytimeAdhoc.map((task) => (
                <AdhocAnytimeRow
                  key={task.id}
                  task={task}
                  onToggle={toggleAdhocComplete}
                  onDelete={handleDeleteAdhoc}
                  onEdit={openEditAdhoc}
                />
              ))}
            </View>
          ) : null}

          {profile?.sleep_target_minutes != null ? (
            <Text style={styles.sleepFooter}>
              Sleep · target {minutesToTime(profile.sleep_target_minutes)}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <RecoverySheet
        recoveryInstance={recoveryInstance}
        copy={recoveryCopy}
        reflectionWhy={reflectionWhy}
        reflectionImprove={reflectionImprove}
        rescheduleSlot={rescheduleSlot}
        sleepTargetMinutes={profile?.sleep_target_minutes ?? null}
        saving={saving}
        onSaveRecovery={handleSaveRecovery}
        onReschedule={handleReschedule}
        onAdjustSlot={handleAdjustSlot}
        onChangeWhy={setReflectionWhy}
        onChangeImprove={setReflectionImprove}
        onClose={closeRecovery}
        onSkip={handleSkipRecovery}
      />

      {toastMessage ? (
        <Animated.View style={[styles.toast, toastAnimatedStyle]} pointerEvents="none">
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      ) : null}

      <AppMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          {
            label: "Plan tomorrow",
            icon: "calendar",
            onPress: () => {
              setMenuOpen(false);
              router.push("/plan-tomorrow");
            },
          },
          {
            label: "Last week",
            icon: "bar-chart-2",
            onPress: () => {
              setMenuOpen(false);
              router.push("/weekly-recap");
            },
          },
          {
            label: "Edit schedule",
            icon: "sliders",
            onPress: () => {
              setMenuOpen(false);
              router.push("/schedule-builder");
            },
          },
          {
            label: "Reset today",
            icon: "rotate-ccw",
            danger: true,
            onPress: () => {
              setMenuOpen(false);
              confirmReset();
            },
          },
        ]}
      />

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
        animationType="none"
        onRequestClose={() => closeUndoSheet()}
      >
        <View style={styles.bottomSheetRoot}>
          <RNAnimated.View
            style={[styles.bottomSheetScrim, { opacity: undoScrimAnim }]}
            pointerEvents="none"
          />
          <Pressable style={styles.bottomSheetOverlayPressable} onPress={() => closeUndoSheet()}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <RNAnimated.View
                style={[styles.undoSheet, { transform: [{ translateY: undoSlideAnim }] }]}
              >
                <View style={styles.undoHandle} />
                <Text style={styles.undoTitle}>
                  {undoInstance?.block?.name ?? "Block"}
                </Text>
                <PressableScale
                  style={styles.undoActionButton}
                  onPress={() => {
                    hapticSelect();
                    if (!undoInstance) return;
                    const inst = undoInstance;
                    closeUndoSheet(() => {
                      if (inst.status === "missed") handleUndoMissed(inst.id);
                      else handleUndoCompletion(inst.id);
                    });
                  }}
                  disabled={saving}
                >
                  <Feather name="rotate-ccw" size={iconSizes.md} color={colors.onPrimary} />
                  <Text style={styles.undoActionText}>
                    {undoInstance?.status === "missed" ? "Undo missed" : "Undo completion"}
                  </Text>
                </PressableScale>
                <Pressable onPress={() => closeUndoSheet()} style={styles.undoCancelButton}>
                  <Text style={styles.undoCancelText}>Cancel</Text>
                </Pressable>
              </RNAnimated.View>
            </Pressable>
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={!!removeInstance}
        transparent
        animationType="none"
        onRequestClose={() => closeRemoveSheet()}
      >
        <View style={styles.bottomSheetRoot}>
          <RNAnimated.View
            style={[styles.bottomSheetScrim, { opacity: removeScrimAnim }]}
            pointerEvents="none"
          />
          <KeyboardAvoidingView
            style={styles.bottomSheetOverlayPressable}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <Pressable style={styles.bottomSheetDismiss} onPress={() => closeRemoveSheet()} />
            <Pressable onPress={(e) => e.stopPropagation()}>
              <RNAnimated.View
                style={[
                  styles.removeSheet,
                  { transform: [{ translateY: removeSlideAnim }] },
                ]}
              >
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
            <PressableScale style={styles.removeConfirmBtn} onPress={handleRemove}>
              <Text style={styles.removeConfirmText}>Remove</Text>
            </PressableScale>
            <PressableScale
              variant="highlight"
              baseColor={colors.surface}
              highlightColor={colors.surfaceNested}
              onPress={() => closeRemoveSheet()}
            >
              <Text style={styles.removeCancelText}>Cancel</Text>
            </PressableScale>
              </RNAnimated.View>
            </Pressable>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={addTaskOpen}
        transparent
        animationType="none"
        onRequestClose={() => closeAddTask()}
      >
        <View style={styles.bottomSheetRoot}>
          <RNAnimated.View
            style={[styles.bottomSheetScrim, { opacity: addTaskScrimAnim }]}
            pointerEvents="none"
          />
          <KeyboardAvoidingView
            style={styles.bottomSheetOverlayPressable}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <Pressable style={styles.bottomSheetDismiss} onPress={() => closeAddTask()} />
            <Pressable onPress={(e) => e.stopPropagation()}>
              <RNAnimated.View
                style={[
                  styles.addTaskSheet,
                  { transform: [{ translateY: addTaskSlideAnim }] },
                ]}
              >
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
                <TimePicker
                  label="Start"
                  valueMinutes={addTaskStartMinutes}
                  onChange={setAddTaskStartMinutes}
                />
                <TimePicker
                  label="End"
                  valueMinutes={addTaskEndMinutes}
                  onChange={setAddTaskEndMinutes}
                />
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
            <TouchableOpacity onPress={() => closeAddTask()} disabled={saving}>
              <Text style={styles.addTaskCancelText}>Cancel</Text>
            </TouchableOpacity>
              </RNAnimated.View>
            </Pressable>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <AdhocEditSheet
        task={editAdhocTask}
        visible={!!editAdhocTask}
        slideAnim={editAdhocSlideAnim}
        scrimAnim={editAdhocScrimAnim}
        name={editAdhocName}
        startMinutes={editAdhocStartMinutes}
        endMinutes={editAdhocEndMinutes}
        saving={saving}
        onChangeName={setEditAdhocName}
        onChangeStart={setEditAdhocStartMinutes}
        onChangeEnd={setEditAdhocEndMinutes}
        onSave={handleSaveEditAdhoc}
        onClose={() => closeEditAdhoc()}
      />
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

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, position: "relative" },
    centered: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: "center",
      justifyContent: "center",
    },
    header: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: radii.round,
      backgroundColor: c.primaryDeep,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: c.primary, ...typography.bodyBold },
    title: { ...typography.display, color: c.text },
    date: { ...typography.small, ...numeric, color: c.textMuted, marginTop: spacing.xs },
    list: { padding: spacing.lg, paddingBottom: 100 },
    scroll: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    empty: { color: c.textFaint, textAlign: "center", marginTop: 40, ...typography.body },
    addAdhocPill: {
      backgroundColor: c.primary,
      borderRadius: radii.pill,
      height: 48,
      marginHorizontal: spacing.xl,
      marginTop: spacing.lg,
      marginBottom: spacing.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    addAdhocPlus: {
      color: "#FFFFFF",
      fontSize: 26,
      fontWeight: "600",
      lineHeight: 28,
      marginTop: -2,
    },
    anytimeTray: {
      marginTop: spacing.lg,
      backgroundColor: c.surfaceDim,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      gap: spacing.xs,
    },
    anytimeTitle: {
      color: c.textMuted,
      ...typography.label,
      textTransform: "uppercase",
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.xs,
    },
    sleepFooter: {
      color: c.textMuted,
      ...typography.small,
      textAlign: "center",
      marginTop: spacing.xl,
      marginBottom: spacing.xxl,
    },
    addTaskSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.pill,
      borderTopRightRadius: radii.pill,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: Platform.OS === "ios" ? 36 : 24,
      gap: spacing.md,
    },
    addTaskTitle: { color: c.text, ...typography.heading },
    addTaskInput: {
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      color: c.text,
      ...typography.body,
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
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    modeBtnActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    modeBtnText: {
      color: c.textMuted,
      ...typography.smallBold,
    },
    modeBtnTextActive: {
      color: c.onPrimary,
    },
    timeFields: {
      gap: spacing.md,
    },
    anytimeHelper: {
      color: c.textMuted,
      ...typography.smallRelaxed,
    },
    addTaskConfirmBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      paddingVertical: 14,
      alignItems: "center",
    },
    addTaskConfirmDisabled: {
      opacity: 0.5,
    },
    addTaskConfirmText: { color: c.onPrimary, ...typography.bodyBold },
    addTaskCancelText: {
      color: c.textMuted,
      ...typography.bodyBold,
      textAlign: "center",
      paddingVertical: spacing.sm,
    },
    toast: {
      position: "absolute",
      bottom: 40,
      left: spacing.xl,
      right: spacing.xl,
      backgroundColor: c.surface,
      borderRadius: radii.lg,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      borderLeftWidth: 3,
      borderLeftColor: c.streak,
    },
    toastText: { color: c.text, ...typography.small },
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    overlayDismiss: {
      flex: 1,
    },
    bottomSheetRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    bottomSheetScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlayScrim,
    },
    bottomSheetOverlayPressable: {
      flex: 1,
      justifyContent: "flex-end",
    },
    bottomSheetDismiss: {
      flex: 1,
    },
    undoSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.pill,
      borderTopRightRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingBottom: Platform.OS === "ios" ? 36 : 24,
      paddingTop: spacing.sm,
      ...c.shadowLift,
      shadowOffset: { width: 0, height: -4 },
    },
    undoHandle: {
      width: 36,
      height: 4,
      borderRadius: radii.xs,
      backgroundColor: c.borderLight,
      alignSelf: "center",
      marginBottom: spacing.md,
    },
    undoTitle: {
      ...typography.smallBold,
      color: c.textMuted,
      textAlign: "center",
      marginBottom: spacing.md,
    },
    undoActionButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: c.primary,
      borderRadius: radii.md,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      marginHorizontal: spacing.md,
    },
    undoActionText: {
      color: c.onPrimary,
      ...typography.bodyBold,
    },
    undoCancelButton: {
      paddingVertical: 14,
      marginTop: spacing.sm,
      alignItems: "center",
    },
    undoCancelText: {
      color: c.textMuted,
      ...typography.body,
      textAlign: "center",
    },
    removeSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.pill,
      borderTopRightRadius: radii.pill,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: Platform.OS === "ios" ? 36 : 24,
      gap: spacing.md,
    },
    removeTitle: { color: c.text, ...typography.heading },
    removeBody: { color: c.textMuted, ...typography.smallRelaxed },
    removeLabel: { color: c.textMuted, ...typography.smallBold },
    removeInput: {
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      color: c.text,
      ...typography.small,
      minHeight: 60,
    },
    removeConfirmBtn: {
      backgroundColor: c.danger,
      borderRadius: radii.lg,
      paddingVertical: 14,
      alignItems: "center",
    },
    removeConfirmText: { color: c.onPrimary, ...typography.bodyBold },
    removeCancelText: {
      color: c.textMuted,
      ...typography.bodyBold,
      textAlign: "center",
      paddingVertical: spacing.sm,
    },
  });
