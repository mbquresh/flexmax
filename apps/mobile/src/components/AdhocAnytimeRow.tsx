import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  NativeSyntheticEvent,
  TextLayoutEventData,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { AdhocTask } from "../types/database";
import { Colors, spacing, radii, iconSizes } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { AdhocSwipeReveal } from "./AdhocSwipeReveal";

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
  const [isTruncated, setIsTruncated] = useState(false);
  const [swipeOpen, setSwipeOpen] = useState(false);
  const closeSwipeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setExpanded(false);
    setIsTruncated(false);
  }, [task.name]);

  const handleNameLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (!expanded) {
      setIsTruncated(e.nativeEvent.lines.length > 2);
    }
  };

  const handleBodyPress = () => {
    if (swipeOpen) {
      closeSwipeRef.current?.();
      return;
    }
    onEdit(task);
  };

  const handleNamePress = () => {
    if (swipeOpen) {
      closeSwipeRef.current?.();
      return;
    }
    setExpanded((v) => !v);
  };

  const nameIsTappable = isTruncated || expanded;

  return (
    <AdhocSwipeReveal
      onDelete={() => onDelete(task)}
      onOpenChange={setSwipeOpen}
      closeRef={closeSwipeRef}
      borderRadius={radii.md}
      style={{ marginBottom: spacing.sm }}
    >
      <Pressable
        style={[styles.row, isDone && styles.rowDone]}
        onPress={handleBodyPress}
      >
        <PressableScale
          onPress={() => onToggle(task)}
          scaleTo={0.9}
          hitSlop={8}
        >
          <View style={[styles.circle, isDone && styles.circleDone]}>
            {isDone ? (
              <Feather name="check" size={iconSizes.md} color={colors.text} />
            ) : null}
          </View>
        </PressableScale>
        <View style={styles.nameWrap}>
          <Text
            style={[styles.nameMeasure, isDone && styles.nameDone]}
            onTextLayout={handleNameLayout}
          >
            {task.name}
          </Text>
          {nameIsTappable ? (
            <TouchableOpacity onPress={handleNamePress} activeOpacity={0.7}>
              <Text
                style={[styles.name, isDone && styles.nameDone]}
                numberOfLines={expanded ? undefined : 2}
              >
                {task.name}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.name, isDone && styles.nameDone]} numberOfLines={2}>
              {task.name}
            </Text>
          )}
        </View>
      </Pressable>
    </AdhocSwipeReveal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
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
    nameWrap: {
      flex: 1,
    },
    nameMeasure: {
      position: "absolute",
      opacity: 0,
      zIndex: -1,
      left: 0,
      right: 0,
      fontSize: 14,
    },
    name: {
      color: c.textSecondary,
      fontSize: 14,
    },
    nameDone: {
      textDecorationLine: "line-through",
      color: c.textMuted,
    },
  });
