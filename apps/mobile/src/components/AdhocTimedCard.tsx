import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolate,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { AdhocTask } from "../types/database";
import { minutesToTime } from "../lib/time";
import { hapticCommit, hapticDetent, hapticSelect } from "../lib/haptics";
import { Colors, spacing, radii, iconSizes, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";

const ACTION_BUTTON_WIDTH = 80;

interface AdhocTimedCardProps {
  task: AdhocTask;
  onToggle: (task: AdhocTask) => void;
  onDelete: (task: AdhocTask) => void;
  onEdit: (task: AdhocTask) => void;
}

export function AdhocTimedCard({ task, onToggle, onDelete, onEdit }: AdhocTimedCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDone = task.status === "completed";
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  const revealWidth = ACTION_BUTTON_WIDTH * 2;
  const translateX = useSharedValue(0);
  const isOpen = useSharedValue(0);

  useEffect(() => {
    setExpanded(false);
    setTruncated(false);
  }, [task.name]);

  const closeSwipe = () => {
    isOpen.value = 0;
    translateX.value = withTiming(0, { duration: 150 });
  };

  const handleEdit = () => {
    closeSwipe();
    onEdit(task);
  };

  const handleDelete = () => {
    closeSwipe();
    hapticCommit();
    onDelete(task);
  };

  const swipeGesture = Gesture.Pan()
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
      translateX.value = withSpring(shouldOpen ? -revealWidth : 0, {
        damping: 20,
        stiffness: 220,
        overshootClamping: true,
      });
      if (shouldOpen) {
        runOnJS(hapticDetent)();
      }
    });

  const slideAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const progress = useDerivedValue(() =>
    Math.min(Math.abs(translateX.value) / revealWidth, 1)
  );

  const editProgress = useDerivedValue(() =>
    interpolate(progress.value, [0.15, 1], [0, 1], Extrapolate.CLAMP)
  );

  const editBtnStyle = useAnimatedStyle(() => ({
    width: editProgress.value * ACTION_BUTTON_WIDTH,
    overflow: "hidden",
  }));

  const deleteBtnStyle = useAnimatedStyle(() => ({
    width: progress.value * ACTION_BUTTON_WIDTH,
    overflow: "hidden",
  }));

  const editActionContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(editProgress.value, [0.3, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      { scale: interpolate(editProgress.value, [0.3, 1], [0.6, 1], Extrapolate.CLAMP) },
    ],
  }));

  const deleteActionContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.3, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      { scale: interpolate(progress.value, [0.3, 1], [0.6, 1], Extrapolate.CLAMP) },
    ],
  }));

  return (
    <View style={styles.wrapper}>
      <View style={styles.actionsBehind}>
        <Animated.View
          style={[styles.actionBtn, styles.editBtn, styles.actionBtnLeftRounded, editBtnStyle]}
        >
          <TouchableOpacity
            style={styles.actionBtnTouch}
            onPress={handleEdit}
            activeOpacity={0.85}
          >
            <Animated.View style={editActionContentStyle}>
              <Feather name="edit-2" size={iconSizes.md} color={colors.onPrimary} />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
        <Animated.View style={[styles.actionBtn, styles.deleteBtn, deleteBtnStyle]}>
          <TouchableOpacity
            style={styles.actionBtnTouch}
            onPress={handleDelete}
            activeOpacity={0.85}
          >
            <Animated.View style={deleteActionContentStyle}>
              <Feather name="trash-2" size={iconSizes.md} color={colors.onPrimary} />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <GestureDetector gesture={swipeGesture}>
        <Animated.View style={[styles.slidingRow, slideAnimatedStyle]}>
          <View style={[styles.card, isDone && styles.cardDone]}>
            <View style={styles.accent} />
            <View style={styles.body}>
              <View style={styles.topRow}>
                <View style={styles.nameBlock}>
                  <Text
                    style={[styles.name, isDone && styles.nameDone]}
                    numberOfLines={expanded ? undefined : 2}
                  >
                    {task.name}
                  </Text>
                  {!expanded ? (
                    <Text
                      style={[styles.name, styles.measureHidden]}
                      onTextLayout={(e) => {
                        const isTruncated = e.nativeEvent.lines.length > 2;
                        if (isTruncated !== truncated) setTruncated(isTruncated);
                      }}
                      pointerEvents="none"
                    >
                      {task.name}
                    </Text>
                  ) : null}
                  {truncated ? (
                    <TouchableOpacity
                      onPress={() => {
                        hapticSelect();
                        setExpanded((v) => !v);
                      }}
                      hitSlop={8}
                    >
                      <Text style={styles.expandToggle}>{expanded ? "Collapse" : "Expand"}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <PressableScale onPress={() => onToggle(task)} scaleTo={0.9} hitSlop={8}>
                  <View style={[styles.actionCircle, isDone && styles.actionCircleDone]}>
                    {isDone ? (
                      <Feather name="check" size={iconSizes.md} color={colors.text} />
                    ) : null}
                  </View>
                </PressableScale>
              </View>
              <Text style={styles.meta}>
                {minutesToTime(task.start_minutes!)} – {minutesToTime(task.end_minutes!)}
              </Text>
              <Text style={styles.tag}>One-off</Text>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrapper: {
      position: "relative",
      overflow: "hidden",
      borderRadius: radii.lg,
      marginBottom: 10,
    },
    actionsBehind: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      flexDirection: "row",
    },
    actionBtn: {
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    actionBtnTouch: {
      flex: 1,
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    actionBtnLeftRounded: {
      borderTopLeftRadius: radii.lg,
      borderBottomLeftRadius: radii.lg,
    },
    editBtn: {
      backgroundColor: c.primary,
    },
    deleteBtn: {
      backgroundColor: c.danger,
    },
    slidingRow: {
      backgroundColor: c.surface,
      borderRadius: radii.lg,
    },
    card: {
      flexDirection: "row",
      overflow: "hidden",
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radii.lg,
      // No shadow. Adhoc cards stay flat to differentiate them from schedule
      // blocks, which are elevated. Do not add shadowRest here.
    },
    cardDone: {
      opacity: 0.55,
    },
    accent: {
      width: 4,
      backgroundColor: c.primary,
      opacity: 0.45,
    },
    body: {
      flex: 1,
      padding: 14,
      gap: spacing.xs,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
    },
    nameBlock: {
      flex: 1,
    },
    name: {
      color: c.text,
      fontSize: 16,
      fontWeight: "600",
    },
    nameDone: {
      textDecorationLine: "line-through",
      color: c.success,
    },
    expandToggle: {
      color: c.primary,
      ...typography.small,
      marginTop: spacing.xs,
    },
    measureHidden: {
      position: "absolute",
      left: 0,
      right: 0,
      opacity: 0,
      zIndex: -1,
    },
    meta: {
      color: c.textMuted,
      fontSize: 13,
    },
    tag: {
      alignSelf: "flex-start",
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    actionCircle: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    actionCircleDone: {
      borderColor: c.success,
      backgroundColor: c.success,
    },
  });
