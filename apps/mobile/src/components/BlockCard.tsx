import React, { useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
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
import { BlockStatus, DailyInstance } from "../types/database";
import { minutesToTime } from "../lib/time";
import { useStore } from "../store";
import { colors, spacing, radii } from "../theme";

const STATUS_COLORS: Record<BlockStatus, string> = {
  pending: colors.border,
  active: colors.border,
  completed: colors.success,
  missed: colors.danger,
  skipped: colors.textPlaceholder,
  rescheduled: colors.textPlaceholder,
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
  onLayout,
  registerFlashTrigger,
  unregisterFlashTrigger,
}: BlockCardProps) {
  const translateY = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const isDone = instance.status === "completed";
  const isMissed = instance.status === "missed";
  const isFixed = isInstanceFixed(instance);

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

  const handleActionPress = () => {
    if (instance.status === "skipped") return;

    if (instance.status === "completed" || instance.status === "missed") {
      onUndo(instance);
      return;
    }

    onCheckIn(instance);
  };

  const panGesture = Gesture.Pan()
    .enabled(!isFixed)
    .activeOffsetY([-10, 10])
    .onUpdate((e) => {
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      translateY.value = withTiming(0, { duration: 150 });
      runOnJS(handleDragEnd)(instance.id, e.translationY);
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
      style={[styles.card, isFixed && styles.cardFixed, animatedCardStyle]}
      onLayout={(e) => {
        const { y, height } = e.nativeEvent.layout;
        onLayout(instance.id, y, height);
      }}
    >
      <Pressable
        style={styles.cardInner}
        onLongPress={() => onMarkMissed(instance)}
        delayLongPress={450}
      >
        {isFixed ? (
          <View style={[styles.dragHandle, styles.dragHandleFixed]}>
            <Text style={styles.dragLinesFixed}>🔒</Text>
          </View>
        ) : (
          <GestureDetector gesture={panGesture}>
            <View style={styles.dragHandle} hitSlop={12}>
              <Text style={styles.dragLines}>≡</Text>
            </View>
          </GestureDetector>
        )}
        <View
          style={[styles.statusBar, { backgroundColor: getStatusColor(instance.status) }]}
        />
        <View style={styles.cardBody}>
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
        </View>
      </Pressable>
      <Animated.View style={flashStyle} pointerEvents="none" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: 10,
    position: "relative",
  },
  cardFixed: {
    backgroundColor: colors.surfaceDim,
    borderLeftWidth: 3,
    borderLeftColor: colors.textMuted,
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
  dragHandleFixed: { opacity: 0.5 },
  dragLinesFixed: { fontSize: 14, lineHeight: 20 },
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
