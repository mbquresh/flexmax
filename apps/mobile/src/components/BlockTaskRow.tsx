import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Pressable, TextInput } from "react-native";
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
import { BlockTask } from "../types/database";
import { hapticCommit, hapticDetent, hapticSelect } from "../lib/haptics";
import { Colors, spacing, radii, iconSizes, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

const ACTION_BUTTON_WIDTH = 80;

interface BlockTaskRowProps {
  task: BlockTask;
  canEdit: boolean;
  fill?: string;
  onToggle: (task: BlockTask) => void;
  onDelete: (task: BlockTask) => void;
  onReschedule: (task: BlockTask) => void;
  onRename: (task: BlockTask, name: string) => void;
}

export function BlockTaskRow({
  task,
  canEdit,
  fill,
  onToggle,
  onDelete,
  onReschedule,
  onRename,
}: BlockTaskRowProps) {
  const { colors } = useTheme();
  const rowFill = fill ?? colors.background;
  const styles = useMemo(() => makeStyles(colors, rowFill), [colors, rowFill]);
  const revealWidth = ACTION_BUTTON_WIDTH * 2;
  const translateX = useSharedValue(0);
  const isOpen = useSharedValue(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.name);

  useEffect(() => {
    setEditing(false);
    setDraft(task.name);
  }, [task.id, task.name]);

  const closeSwipe = () => {
    isOpen.value = 0;
    translateX.value = withTiming(0, { duration: 150 });
  };

  const handleReschedule = () => {
    closeSwipe();
    hapticSelect();
    onReschedule(task);
  };

  const handleDelete = () => {
    closeSwipe();
    hapticCommit();
    onDelete(task);
  };

  const commitRename = () => {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed || trimmed === task.name) {
      setDraft(task.name);
      return;
    }
    onRename(task, trimmed);
  };

  const swipeGesture = Gesture.Pan()
    .enabled(canEdit && !editing)
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

  const rescheduleProgress = useDerivedValue(() =>
    interpolate(progress.value, [0.15, 1], [0, 1], Extrapolate.CLAMP)
  );

  const rescheduleBtnStyle = useAnimatedStyle(() => ({
    width: rescheduleProgress.value * ACTION_BUTTON_WIDTH,
    overflow: "hidden",
  }));

  const deleteBtnStyle = useAnimatedStyle(() => ({
    width: progress.value * ACTION_BUTTON_WIDTH,
    overflow: "hidden",
  }));

  const rescheduleActionContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rescheduleProgress.value, [0.3, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      {
        scale: interpolate(rescheduleProgress.value, [0.3, 1], [0.6, 1], Extrapolate.CLAMP),
      },
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
          style={[
            styles.actionBtn,
            styles.rescheduleBtn,
            styles.actionBtnLeftRounded,
            rescheduleBtnStyle,
          ]}
        >
          <TouchableOpacity
            style={styles.actionBtnTouch}
            onPress={handleReschedule}
            activeOpacity={0.85}
          >
            <Animated.View style={rescheduleActionContentStyle}>
              <Feather name="calendar" size={iconSizes.md} color={colors.onPrimary} />
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
          <View style={styles.row}>
            <Pressable
              onPress={() => {
                hapticSelect();
                onToggle(task);
              }}
              hitSlop={8}
              disabled={!canEdit || editing}
              style={styles.taskCheckHit}
            >
              <View style={[styles.taskCheck, task.done && styles.taskCheckDone]}>
                {task.done ? (
                  <Feather name="check" size={10} color={colors.background} />
                ) : null}
              </View>
            </Pressable>
            {editing ? (
              <TextInput
                style={styles.renameInput}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={commitRename}
                onBlur={commitRename}
                autoFocus
                returnKeyType="done"
                blurOnSubmit
              />
            ) : (
              <Pressable
                style={styles.taskNameHit}
                onPress={() => {
                  if (!canEdit) return;
                  closeSwipe();
                  hapticSelect();
                  setDraft(task.name);
                  setEditing(true);
                }}
                disabled={!canEdit}
              >
                <Text style={[styles.taskName, task.done && styles.taskNameDone]}>
                  {task.name}
                </Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const makeStyles = (c: Colors, fill: string) =>
  StyleSheet.create({
    wrapper: {
      position: "relative",
      overflow: "hidden",
      borderRadius: radii.md,
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
    rescheduleBtn: {
      backgroundColor: c.primary,
    },
    deleteBtn: {
      backgroundColor: c.danger,
    },
    slidingRow: {
      backgroundColor: fill,
      borderRadius: radii.md,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      backgroundColor: fill,
    },
    taskCheckHit: { paddingTop: 2 },
    taskCheck: {
      width: 16,
      height: 16,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: c.textMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    taskCheckDone: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    taskNameHit: { flex: 1 },
    taskName: {
      color: c.text,
      ...typography.body,
      flex: 1,
    },
    taskNameDone: {
      color: c.textFaint,
      textDecorationLine: "line-through",
    },
    renameInput: {
      flex: 1,
      color: c.text,
      ...typography.body,
      padding: 0,
      margin: 0,
    },
  });
