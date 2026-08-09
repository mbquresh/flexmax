import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AdhocTask } from "../types/database";
import { colors, spacing, radii, iconSizes } from "../theme";

interface AdhocAnytimeRowProps {
  task: AdhocTask;
  onToggle: (task: AdhocTask) => void;
}

export function AdhocAnytimeRow({ task, onToggle }: AdhocAnytimeRowProps) {
  const isDone = task.status === "completed";

  return (
    <TouchableOpacity
      style={[styles.row, isDone && styles.rowDone]}
      onPress={() => onToggle(task)}
      activeOpacity={0.85}
    >
      <View style={[styles.circle, isDone && styles.circleDone]}>
        {isDone ? <Feather name="check" size={iconSizes.md} color={colors.text} /> : null}
      </View>
      <Text style={[styles.name, isDone && styles.nameDone]} numberOfLines={2}>
        {task.name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  rowDone: {
    opacity: 0.55,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  circleDone: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  name: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 14,
  },
  nameDone: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
});
