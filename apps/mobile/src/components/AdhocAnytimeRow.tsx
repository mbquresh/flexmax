import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { hapticCommit, hapticDetent, hapticPickUp, hapticSelect } from "../lib/haptics";
import { Colors, spacing, radii, iconSizes, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";

const ACTION_BUTTON_WIDTH = 80;

interface AdhocAnytimeRowProps {
  task: AdhocTask;
  onToggle: (task: AdhocTask) => void;
  onDelete: (task: AdhocTask) => void;
  onEdit: (task: AdhocTask) => void;
}

export function AdhocAnytimeRow({ task, onToggle, onDelete, onEdit }: AdhocAnytimeRowProps) {
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

  const toggleExpanded = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

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

  const longPressGesture = Gesture.LongPress().onStart(() => {
    runOnJS(hapticPickUp)();
    runOnJS(toggleExpanded)();
  });

  const contentGesture = Gesture.Exclusive(swipeGesture, longPressGesture);

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

      <GestureDetector gesture={contentGesture}>
        <Animated.View style={[styles.slidingRow, slideAnimatedStyle]}>
          <View style={[styles.row, isDone && styles.rowDone]}>
            <PressableScale onPress={() => onToggle(task)} scaleTo={0.9} hitSlop={8}>
              <View style={[styles.circle, isDone && styles.circleDone]}>
                {isDone ? (
                  <Feather name="check" size={iconSizes.md} color={colors.text} />
                ) : null}
              </View>
            </PressableScale>
            <View style={styles.nameBlock}>
              <Text
                style={[styles.name, isDone && styles.nameDone]}
                numberOfLines={expanded ? undefined : 2}
                onTextLayout={(e) => {
                  if (!expanded && e.nativeEvent.lines.length > 2) setTruncated(true);
                }}
              >
                {task.name}
              </Text>
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
      borderRadius: radii.md,
      marginBottom: spacing.sm,
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
      borderTopLeftRadius: radii.md,
      borderBottomLeftRadius: radii.md,
    },
    editBtn: {
      backgroundColor: c.primary,
    },
    deleteBtn: {
      backgroundColor: c.danger,
    },
    slidingRow: {
      backgroundColor: c.surface,
      borderRadius: radii.md,
    },
    row: {
      backgroundColor: c.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      ...c.shadowRest,
    },
    rowDone: {
      opacity: 0.55,
    },
    circle: {
      width: 24,
      height: 24,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderColor: c.textMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    circleDone: {
      borderColor: c.success,
      backgroundColor: c.success,
    },
    nameBlock: {
      flex: 1,
    },
    name: {
      color: c.textSecondary,
      fontSize: 14,
    },
    nameDone: {
      textDecorationLine: "line-through",
      color: c.textMuted,
    },
    expandToggle: {
      color: c.primary,
      ...typography.small,
      marginTop: spacing.xs,
    },
  });
