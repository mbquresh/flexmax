import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AdhocTask } from "../types/database";
import { Colors, spacing, radii, iconSizes } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";

interface AdhocAnytimeRowProps {
  task: AdhocTask;
  onToggle: (task: AdhocTask) => void;
}

export function AdhocAnytimeRow({ task, onToggle }: AdhocAnytimeRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDone = task.status === "completed";

  return (
    <PressableScale
      variant="highlight"
      baseColor={colors.surface}
      highlightColor={colors.surfaceNested}
      style={[styles.row, isDone && styles.rowDone]}
      onPress={() => onToggle(task)}
    >
      <View style={[styles.circle, isDone && styles.circleDone]}>
        {isDone ? <Feather name="check" size={iconSizes.md} color={colors.text} /> : null}
      </View>
      <Text style={[styles.name, isDone && styles.nameDone]} numberOfLines={2}>
        {task.name}
      </Text>
    </PressableScale>
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
    name: {
      flex: 1,
      color: c.textSecondary,
      fontSize: 14,
    },
    nameDone: {
      textDecorationLine: "line-through",
      color: c.textMuted,
    },
  });
