import React, { useCallback, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { BlockStatus, DailyInstance } from "../types/database";
import { minutesToTime } from "../lib/time";
import { useStore } from "../store";
import { colors, spacing, radii } from "../theme";

const ACTION_BUTTON_WIDTH = 80;
const REVEAL_WIDTH_PENDING = 160;
const REVEAL_WIDTH_SINGLE = 80;

const STATUS_COLORS: Record<BlockStatus, string> = {
  pending: colors.border,
  active: colors.border,
  completed: colors.success,
  missed: colors.danger,
  skipped: colors.textPlaceholder,
  rescheduled: colors.textPlaceholder,
  removed: colors.textPlaceholder,
};

function getStatusColor(status: BlockStatus): string {
  return STATUS_COLORS[status] ?? STATUS_COLORS.pending;
}

function isInstanceFixed(instance: DailyInstance): boolean {
  return instance.is_fixed || !!instance.block?.is_fixed;
}

interface BlockCardProps {
  instance: DailyInstance;
  saving: boolean;
  cardPositions: React.MutableRefObject<Record<string, { y: number; height: number }>>;
  onCheckIn: (instance: DailyInstance) => void;
  onMarkMissed: (instance: DailyInstance) => void;
  onUndo: (instance: DailyInstance) => void;
  onTaskDetail: (instance: DailyInstance) => void;
  onSwap: (dragged: DailyInstance, target: DailyInstance) => void;
  onRemoveRequest: (instance: DailyInstance) => void;
  onLayout: (id: string, y: number, height: number) => void;
  registerFlashTrigger: (id: string, trigger: () => void) => void;
  unregisterFlashTrigger: (id: string) => void;
}

export function BlockCard({
  instance,
  saving,
  cardPositions,
  onCheckIn,
  onMarkMissed,
  onUndo,
  onTaskDetail,
  onSwap,
  onRemoveRequest,
  onLayout,
  registerFlashTrigger,
  unregisterFlashTrigger,
}: BlockCardProps) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const isDragging = useSharedValue(0);
  const isOpen = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const isDone = instance.status === "completed";
  const isMissed = instance.status === "missed";
  const isFixed = isInstanceFixed(instance);
  const isPending = instance.status === "pending";
  const revealWidth = isPending ? REVEAL_WIDTH_PENDING : REVEAL_WIDTH_SINGLE;

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
    registerFlashTrigger(instance.id, triggerFlash);
    return () => unregisterFlashTrigger(instance.id);
  }, [instance.id, registerFlashTrigger, unregisterFlashTrigger]);

  const findSwapTarget = useCallback(
    (draggedId: string, dragTranslationY: number): DailyInstance | null => {
      const dragged = cardPositions.current[draggedId];
      if (!dragged) return null;

      const draggedCenterY = dragged.y + dragged.height / 2 + dragTranslationY;
      const instances = [...useStore.getState().todayInstances].sort(
        (a, b) => a.start_minutes - b.start_minutes
      );

      for (const inst of instances) {
        if (inst.id === draggedId) continue;
        if (isInstanceFixed(inst)) continue;
        if (inst.status === "removed") continue;
        const pos = cardPositions.current[inst.id];
        if (!pos) continue;
        if (draggedCenterY >= pos.y && draggedCenterY <= pos.y + pos.height) {
          return inst;
        }
      }
      return null;
    },
    [cardPositions]
  );

  const handleDragEnd = useCallback(
    (draggedId: string, dragTranslationY: number) => {
      const swapTarget = findSwapTarget(draggedId, dragTranslationY);
      if (!swapTarget) return;

      const dragged = useStore.getState().todayInstances.find((i) => i.id === draggedId);
      if (!dragged || isInstanceFixed(dragged)) return;

      onSwap(dragged, swapTarget);
    },
    [findSwapTarget, onSwap]
  );

  const closeSwipe = () => {
    isOpen.value = 0;
    translateX.value = withTiming(0, { duration: 150 });
  };

  const onCardPress = () => {
    if (instance.status === "skipped" || saving) return;

    if (instance.status === "completed" || instance.status === "missed") {
      onUndo(instance);
      return;
    }

    onCheckIn(instance);
  };

  const handleActionPress = () => {
    onCardPress();
  };

  const dragGesture = Gesture.Pan()
    .enabled(!isFixed)
    .onStart(() => {
      isDragging.value = 1;
      scale.value = withTiming(1.03, { duration: 120 });
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      isDragging.value = 0;
      scale.value = withTiming(1, { duration: 120 });
      translateY.value = withTiming(0, { duration: 150 });
      runOnJS(handleDragEnd)(instance.id, e.translationY);
    })
    .onFinalize(() => {
      isDragging.value = 0;
      scale.value = withTiming(1, { duration: 120 });
    });

  const swipeGesture = Gesture.Pan()
    .enabled(!isFixed)
    .activeOffsetX([-15, 15])
    .failOffsetY([-8, 8])
    .maxPointers(1)
    .onUpdate((e) => {
      const base = isOpen.value ? -revealWidth : 0;
      translateX.value = Math.max(-revealWidth, Math.min(0, base + e.translationX));
    })
    .onEnd(() => {
      const shouldOpen = translateX.value < -revealWidth / 2;
      isOpen.value = shouldOpen ? 1 : 0;
      translateX.value = withTiming(shouldOpen ? -revealWidth : 0, { duration: 150 });
    });

  const wrapperAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    zIndex: isDragging.value ? 100 : 1,
    elevation: isDragging.value ? 8 : 0,
  }));

  const slideAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
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
      style={[styles.cardWrapper, wrapperAnimatedStyle]}
      onLayout={(e) => {
        const { y, height } = e.nativeEvent.layout;
        onLayout(instance.id, y, height);
      }}
    >
      <View style={styles.actionsBehind}>
        {isPending && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.missedBtn, styles.actionBtnLeftRounded]}
            onPress={() => {
              closeSwipe();
              onMarkMissed(instance);
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionText, styles.missedBtnText]}>Missed</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.removeBtn,
            !isPending && styles.actionBtnLeftRounded,
          ]}
          onPress={() => {
            closeSwipe();
            onRemoveRequest(instance);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.actionText}>Remove</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[styles.slidingRow, isFixed && styles.slidingRowFixed, slideAnimatedStyle]}
      >
        {!isFixed ? (
          <GestureDetector gesture={dragGesture}>
            <View style={styles.dragHandleZone} hitSlop={8}>
              <Text style={styles.dragHandleText}>⠿</Text>
            </View>
          </GestureDetector>
        ) : (
          <View style={styles.dragHandleZone}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>
        )}

        <GestureDetector gesture={swipeGesture}>
          <Pressable style={styles.cardBody} onPress={onCardPress}>
            <View
              style={[styles.statusBar, { backgroundColor: getStatusColor(instance.status) }]}
            />
            <View style={styles.cardMain}>
              <View style={styles.blockNameRow}>
                <Text style={styles.blockName}>{instance.block?.name ?? "Block"}</Text>
                {isFixed ? <Text style={styles.lockIcon}>🔒</Text> : null}
              </View>
              <Text style={styles.meta}>
                {minutesToTime(instance.start_minutes)} – {minutesToTime(instance.end_minutes)}
              </Text>
              <TouchableOpacity onPress={() => onTaskDetail(instance)} hitSlop={8}>
                {instance.task_detail ? (
                  <Text style={styles.task}>{instance.task_detail}</Text>
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
              onPress={handleActionPress}
              disabled={instance.status === "skipped" || saving}
              hitSlop={8}
            >
              {isDone ? (
                <Text style={styles.actionCircleCheck}>✓</Text>
              ) : isMissed ? (
                <Text style={styles.actionCircleMissedIcon}>!</Text>
              ) : null}
            </TouchableOpacity>

            <Animated.View style={flashStyle} pointerEvents="none" />
          </Pressable>
        </GestureDetector>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 10,
    position: "relative",
    overflow: "hidden",
    borderRadius: radii.lg,
  },
  actionsBehind: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
  },
  actionBtn: {
    width: ACTION_BUTTON_WIDTH,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  missedBtn: {
    backgroundColor: colors.dangerTint,
  },
  actionBtnLeftRounded: {
    borderTopLeftRadius: radii.lg,
    borderBottomLeftRadius: radii.lg,
  },
  missedBtnText: {
    color: colors.danger,
  },
  removeBtn: {
    backgroundColor: colors.danger,
  },
  actionText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  slidingRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
  },
  slidingRowFixed: {
    backgroundColor: colors.surfaceDim,
    borderLeftWidth: 3,
    borderLeftColor: colors.textMuted,
  },
  dragHandleZone: {
    width: 28,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  dragHandleText: {
    color: colors.textDisabled,
    fontSize: 18,
    lineHeight: 18,
    textAlignVertical: "center",
    includeFontPadding: false,
    marginTop: 6,
  },
  statusBar: { width: 4 },
  cardBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    paddingLeft: spacing.sm,
    gap: spacing.md,
    borderRadius: radii.lg,
  },
  cardMain: { flex: 1 },
  blockNameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  blockName: { color: colors.text, fontSize: 16, fontWeight: "600" },
  lockIcon: { fontSize: 14 },
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
});
