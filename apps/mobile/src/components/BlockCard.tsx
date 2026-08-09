import React, { useCallback, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { DailyInstance } from "../types/database";
import { minutesToTime } from "../lib/time";
import { hapticPickUp, hapticDetent } from "../lib/haptics";
import { DragHandle } from "./DragHandle";
import { PressableScale } from "./PressableScale";
import { useStore } from "../store";
import { Colors, spacing, radii, iconSizes, typography, numeric } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

const ACTION_BUTTON_WIDTH = 80;
const REVEAL_WIDTH_PENDING = 160;
const REVEAL_WIDTH_SINGLE = 80;

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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const isDragging = useSharedValue(0);
  const isOpen = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const isDone = instance.status === "completed";
  const isMissed = instance.status === "missed";
  const isFixed = isInstanceFixed(instance);
  // Unanswered = still awaiting a decision. Blocks become "active" once
  // their start time passes, and must remain swipeable.
  const isUnanswered =
    instance.status === "pending" || instance.status === "active";
  // Swipe actions are for blocks still awaiting a decision. Answered blocks
  // are corrected by tapping the action circle, which toggles state.
  const isAnswered =
    instance.status === "completed" ||
    instance.status === "missed" ||
    instance.status === "skipped";
  const statusFade = useSharedValue(isAnswered ? 1 : 0);
  const revealWidth = isUnanswered ? REVEAL_WIDTH_PENDING : REVEAL_WIDTH_SINGLE;

  const triggerFlash = () => {
    flashOpacity.value = withSequence(
      withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
      withDelay(160, withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) }))
    );
  };

  useEffect(() => {
    registerFlashTrigger(instance.id, triggerFlash);
    return () => unregisterFlashTrigger(instance.id);
  }, [instance.id, registerFlashTrigger, unregisterFlashTrigger]);

  useEffect(() => {
    if (isAnswered) {
      // Animate the tray shut before the gesture gate takes effect —
      // otherwise it stays translated open with no way to close.
      isOpen.value = 0;
      translateX.value = withTiming(0, { duration: 150 });
    }
  }, [isAnswered]);

  useEffect(() => {
    statusFade.value = withTiming(isAnswered ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [isAnswered]);

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
    if (saving) return;

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
      runOnJS(hapticPickUp)();
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
    .enabled(!isFixed && !isAnswered)
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
      if (shouldOpen) {
        runOnJS(hapticDetent)();
      }
    });

  const cardShadowAnimatedStyle = useAnimatedStyle(() => ({
    shadowColor: colors.shadowRest.shadowColor,
    shadowOffset: colors.shadowRest.shadowOffset,
    shadowOpacity: interpolate(
      isDragging.value,
      [0, 1],
      [colors.shadowRest.shadowOpacity, colors.shadowLift.shadowOpacity]
    ),
    shadowRadius: interpolate(
      isDragging.value,
      [0, 1],
      [colors.shadowRest.shadowRadius, colors.shadowLift.shadowRadius]
    ),
  }));

  const wrapperAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    zIndex: isDragging.value ? 100 : 1,
  }));

  const slideAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value * 0.14,
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
  }));

  // Exact match to the check-in sheet's rating borders, so the sheet acts as
  // the legend for the card and the user learns one color vocabulary.
  const completedColor =
    instance.completion_rating === "partial"
      ? colors.ratingOkayBorder
      : instance.completion_rating === "pulled_away"
        ? colors.ratingBadBorder
        : colors.success;

  const statusBarOverlayColor = isDone
    ? completedColor
    : isMissed
      ? colors.danger
      : colors.border;

  const statusBarOverlayStyle = useAnimatedStyle(() => ({
    opacity: statusFade.value,
    backgroundColor: statusBarOverlayColor,
  }));

  const targetBorder = isDone
    ? colors.success
    : isMissed
      ? colors.danger
      : colors.primary;
  const targetFill = isDone ? colors.success : colors.surface;

  const circleAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      statusFade.value,
      [0, 1],
      [colors.primary, targetBorder]
    ),
    backgroundColor: interpolateColor(
      statusFade.value,
      [0, 1],
      [colors.surface, targetFill]
    ),
  }));

  const actionIconStyle = useAnimatedStyle(() => ({
    opacity: statusFade.value,
    transform: [{ scale: 0.85 + statusFade.value * 0.15 }],
  }));

  return (
    <Animated.View style={[styles.cardShadow, cardShadowAnimatedStyle]}>
      <Animated.View
        style={[styles.cardWrapper, wrapperAnimatedStyle]}
        onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout;
          onLayout(instance.id, y, height);
        }}
      >
      <View style={styles.actionsBehind}>
        {isUnanswered && (
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
            !isUnanswered && styles.actionBtnLeftRounded,
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
              <DragHandle />
            </View>
          </GestureDetector>
        ) : (
          <View style={styles.dragHandleZone}>
            <Feather name="lock" size={iconSizes.sm} color={colors.textMuted} />
          </View>
        )}

        <GestureDetector gesture={swipeGesture}>
          <Pressable style={styles.cardBody} onPress={onCardPress}>
            <View style={styles.statusBar}>
              <Animated.View
                style={[styles.statusBarOverlay, statusBarOverlayStyle]}
                pointerEvents="none"
              />
            </View>
            <View style={styles.cardMain}>
              <View style={styles.blockNameRow}>
                <Text style={styles.blockName}>{instance.block?.name ?? "Block"}</Text>
                {isFixed ? (
                  <Feather name="lock" size={iconSizes.sm} color={colors.textMuted} />
                ) : null}
              </View>
              <Text style={styles.meta}>
                {minutesToTime(instance.start_minutes)} – {minutesToTime(instance.end_minutes)}
              </Text>
              <TouchableOpacity onPress={() => onTaskDetail(instance)} hitSlop={8}>
                {instance.task_detail ? (
                  <Text style={styles.task}>{instance.task_detail}</Text>
                ) : (
                  <View style={styles.taskAddRow}>
                    <Text style={styles.taskAdd}>Add task</Text>
                    <Feather name="arrow-right" size={iconSizes.xs} color={colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <PressableScale
              onPress={handleActionPress}
              disabled={saving}
              scaleTo={0.9}
              hitSlop={8}
            >
              <Animated.View style={[styles.actionCircle, circleAnimatedStyle]}>
                <Animated.View style={actionIconStyle}>
                  {isDone ? (
                    <Feather name="check" size={iconSizes.md} color={colors.text} />
                  ) : isMissed ? (
                    <Feather name="minus" size={iconSizes.md} color={colors.danger} />
                  ) : null}
                </Animated.View>
              </Animated.View>
            </PressableScale>
          </Pressable>
        </GestureDetector>
        <Animated.View style={flashStyle} pointerEvents="none" />
      </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    cardShadow: {
      backgroundColor: c.surface,
      borderRadius: radii.lg,
      marginBottom: 10,
      ...c.shadowRest,
    },
    cardWrapper: {
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
      backgroundColor: c.dangerTint,
    },
    actionBtnLeftRounded: {
      borderTopLeftRadius: radii.lg,
      borderBottomLeftRadius: radii.lg,
    },
    missedBtnText: {
      color: c.danger,
    },
    removeBtn: {
      backgroundColor: c.danger,
    },
    actionText: {
      color: c.onPrimary,
      ...typography.smallBold,
    },
    slidingRow: {
      flexDirection: "row",
      alignItems: "stretch",
      backgroundColor: c.surface,
      borderRadius: radii.lg,
    },
    slidingRowFixed: {
      backgroundColor: c.surfaceDim,
      borderLeftWidth: 3,
      borderLeftColor: c.textMuted,
    },
    dragHandleZone: {
      width: 28,
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "center",
      borderRightWidth: 1,
      borderRightColor: c.border,
    },
    statusBar: {
      width: 4,
      alignSelf: "stretch",
      borderRadius: radii.xs,
      backgroundColor: c.border,
      position: "relative",
    },
    statusBarOverlay: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: radii.xs,
    },
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
    blockName: { color: c.text, ...typography.bodyBold },
    meta: { color: c.textMuted, ...typography.small, ...numeric, marginTop: spacing.xs },
    task: { color: c.textSecondary, ...typography.small, marginTop: spacing.sm },
    taskAddRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    taskAdd: { color: c.primary, ...typography.smallBold },
    actionCircle: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
  });
