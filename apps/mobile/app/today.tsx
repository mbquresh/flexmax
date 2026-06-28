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
import { getTodayLabel } from "../src/lib/schedule";
import { useAuth } from "../src/providers/AuthProvider";
import { useStore } from "../src/store";
import {
  BlockStatus,
  CompletionRating,
  DailyInstance,
} from "../src/types/database";
import { minutesToTime } from "../src/lib/time";
import { RequireAuth } from "../src/components/RequireAuth";

const STATUS_COLORS: Record<BlockStatus, string> = {
  pending: "#333",
  active: "#333",
  completed: "#5DCAA5",
  missed: "#F0997B",
  skipped: "#555",
  rescheduled: "#555",
};

const RATING_OPTIONS: { value: CompletionRating; label: string }[] = [
  { value: "crushed", label: "Crushed it" },
  { value: "partial", label: "Partly" },
  { value: "pulled_away", label: "Got pulled away" },
];

function getStatusColor(status: BlockStatus): string {
  return STATUS_COLORS[status] ?? STATUS_COLORS.pending;
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
    borderColor: "#EF9F27",
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
  const { session, signOut } = useAuth();
  const { todayInstances, setTodayInstances, updateInstance } = useStore();
  const [loading, setLoading] = useState(true);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [checkInInstance, setCheckInInstance] = useState<DailyInstance | null>(null);
  const [undoInstance, setUndoInstance] = useState<DailyInstance | null>(null);
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
  const today = new Date().toISOString().split("T")[0];
  const todayLabel = getTodayLabel();

  const sortedInstances = [...todayInstances].sort(
    (a, b) => a.start_minutes - b.start_minutes
  );

  useEffect(() => {
    if (!session?.user.id) return;

    let cancelled = false;
    setLoading(true);

    const loadToday = async () => {
      await generateDailyInstances(today);

      const { count } = await supabase
        .from("schedule_blocks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id);

      setTotalBlocks(count ?? 0);

      const { data, error } = await supabase
        .from("daily_schedule_instances")
        .select("*, block:schedule_blocks(*)")
        .eq("user_id", session.user.id)
        .eq("date", today)
        .order("start_minutes");

      if (error) {
        console.error(error);
      } else if (!cancelled) {
        setTodayInstances(data ?? []);
      }
      if (!cancelled) setLoading(false);
    };

    loadToday();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id, today, setTodayInstances]);

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
    const aStart = instanceA.start_minutes;
    const aEnd = instanceA.end_minutes;

    setSaving(true);
    try {
      const { error: errorA } = await supabase
        .from("daily_schedule_instances")
        .update({
          start_minutes: instanceB.start_minutes,
          end_minutes: instanceB.end_minutes,
        })
        .eq("id", instanceA.id);

      if (errorA) throw errorA;

      const { error: errorB } = await supabase
        .from("daily_schedule_instances")
        .update({ start_minutes: aStart, end_minutes: aEnd })
        .eq("id", instanceB.id);

      if (errorB) throw errorB;

      updateInstance(instanceA.id, {
        start_minutes: instanceB.start_minutes,
        end_minutes: instanceB.end_minutes,
      });
      updateInstance(instanceB.id, {
        start_minutes: aStart,
        end_minutes: aEnd,
      });

      setTodayInstances(
        [...useStore.getState().todayInstances]
          .map((inst) => {
            if (inst.id === instanceA.id) {
              return {
                ...inst,
                start_minutes: instanceB.start_minutes,
                end_minutes: instanceB.end_minutes,
              };
            }
            if (inst.id === instanceB.id) {
              return { ...inst, start_minutes: aStart, end_minutes: aEnd };
            }
            return inst;
          })
          .sort((a, b) => a.start_minutes - b.start_minutes)
      );

      showToast(
        `${instanceA.block?.name ?? "Block"} swapped with ${instanceB.block?.name ?? "block"}`
      );
      triggerFlash(instanceA.id);
      triggerFlash(instanceB.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not swap blocks";
      if (Platform.OS === "web") console.error(message);
      else Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
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

  const handleLongPress = async (item: DailyInstance) => {
    if (item.status !== "pending" && item.status !== "active") return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("daily_schedule_instances")
        .update({ status: "missed" })
        .eq("id", item.id);

      if (error) throw error;
      updateInstance(item.id, { status: "missed" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not mark missed";
      if (Platform.OS === "web") console.error(message);
      else Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
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
        <ActivityIndicator size="large" color="#534AB7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Today</Text>
        <Text style={styles.date}>
          {today} · {todayLabel}
        </Text>
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
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
              onLongPress={() => handleLongPress(item)}
              onActionPress={() => handleActionPress(item)}
              onOpenTaskDetail={() => openTaskDetail(item)}
              onCardLayout={handleCardLayout}
              onDragEnd={handleDragEnd}
              registerFlashTrigger={registerFlashTrigger}
              unregisterFlashTrigger={unregisterFlashTrigger}
            />
          ))
        )}
      </ScrollView>

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
                <ActivityIndicator color="#534AB7" style={styles.sheetSaving} />
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
              placeholderTextColor="#555"
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
                <ActivityIndicator color="#EEEDFE" />
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
  container: { flex: 1, backgroundColor: "#0f0f12", position: "relative" },
  centered: {
    flex: 1,
    backgroundColor: "#0f0f12",
    alignItems: "center",
    justifyContent: "center",
  },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: "700", color: "#f0f0f0" },
  date: { fontSize: 14, color: "#888", marginTop: 4 },
  headerActions: { flexDirection: "row", gap: 16, marginTop: 12 },
  link: { color: "#534AB7", fontSize: 14 },
  list: { padding: 16, flexGrow: 1, paddingBottom: 100 },
  card: {
    backgroundColor: "#1e1e28",
    borderRadius: 12,
    marginBottom: 10,
    position: "relative",
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    borderRadius: 12,
  },
  dragHandle: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  dragLines: { color: "#444", fontSize: 18, lineHeight: 20 },
  statusBar: { width: 4 },
  cardBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    paddingLeft: 8,
    gap: 12,
  },
  cardMain: { flex: 1 },
  blockName: { color: "#f0f0f0", fontSize: 16, fontWeight: "600" },
  meta: { color: "#888", fontSize: 13, marginTop: 4 },
  task: { color: "#d0d0d0", fontSize: 14, marginTop: 8 },
  taskAdd: { color: "#534AB7", fontSize: 13, marginTop: 8, fontWeight: "500" },
  actionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#534AB7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  actionCircleDone: {
    borderColor: "#5DCAA5",
    backgroundColor: "#5DCAA5",
  },
  actionCircleMissed: {
    borderColor: "#F0997B",
    backgroundColor: "transparent",
  },
  actionCircleCheck: { color: "#0f0f12", fontSize: 16, fontWeight: "700" },
  actionCircleMissedIcon: { color: "#F0997B", fontSize: 16, fontWeight: "700" },
  empty: { color: "#666", textAlign: "center", marginTop: 40, lineHeight: 22 },
  toast: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "#1e1e28",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#EF9F27",
  },
  toastText: { color: "#f0f0f0", fontSize: 14 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  overlayDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#444",
    marginBottom: 16,
  },
  sheetTitle: {
    color: "#f0f0f0",
    fontSize: 18,
    fontWeight: "600",
  },
  sheetTime: { color: "#888", fontSize: 14, marginBottom: 20, marginTop: 6 },
  ratingRow: { flexDirection: "row", gap: 8 },
  ratingBtn: {
    flex: 1,
    backgroundColor: "#1e1e28",
    borderWidth: 0.5,
    borderColor: "#333",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  ratingBtnActive: {
    backgroundColor: "#534AB7",
    borderColor: "#534AB7",
  },
  ratingBtnText: {
    color: "#EEEDFE",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  sheetSaving: { marginTop: 16 },
  taskSheet: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingTop: 16,
  },
  taskSheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  taskSheetHeaderText: { flex: 1 },
  taskSheetSubtitle: { color: "#888", fontSize: 14, marginTop: 4 },
  taskSheetClose: { color: "#888", fontSize: 20, lineHeight: 22 },
  taskDetailInput: {
    backgroundColor: "#1a1a1a",
    borderWidth: 0.5,
    borderColor: "#333",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#f0f0f0",
    fontSize: 15,
    minHeight: 88,
    maxHeight: 88,
  },
  taskSaveBtn: {
    marginTop: 16,
    backgroundColor: "#534AB7",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  taskSaveBtnText: { color: "#EEEDFE", fontSize: 15, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
  undoSheet: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: "auto",
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  undoOption: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "#2a2a2a",
    alignItems: "center",
  },
  undoOptionLast: { borderBottomWidth: 0 },
  undoOptionDestructive: { color: "#F0997B", fontSize: 16, fontWeight: "600" },
  undoOptionCancel: { color: "#888", fontSize: 16, fontWeight: "500" },
});
