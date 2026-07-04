import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { AdhocTask } from "../types/database";
import { minutesToTime } from "../lib/time";
import { colors, spacing, radii } from "../theme";

interface AdhocTimedCardProps {
  task: AdhocTask;
  onToggle: (task: AdhocTask) => void;
}

export function AdhocTimedCard({ task, onToggle }: AdhocTimedCardProps) {
  const isDone = task.status === "completed";

  return (
    <TouchableOpacity
      style={[styles.card, isDone && styles.cardDone]}
      onPress={() => onToggle(task)}
      activeOpacity={0.85}
    >
      <View style={styles.accent} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.name, isDone && styles.nameDone]} numberOfLines={2}>
            {task.name}
          </Text>
          <View style={[styles.actionCircle, isDone && styles.actionCircleDone]}>
            {isDone ? <Text style={styles.actionCheck}>✓</Text> : null}
          </View>
        </View>
        <Text style={styles.meta}>
          {minutesToTime(task.start_minutes!)} – {minutesToTime(task.end_minutes!)}
        </Text>
        <Text style={styles.tag}>One-off</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.dangerTint,
  },
  cardDone: {
    opacity: 0.55,
  },
  accent: {
    width: 4,
    backgroundColor: colors.danger,
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
  name: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  nameDone: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  tag: {
    alignSelf: "flex-start",
    color: colors.danger,
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
    borderColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCircleDone: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  actionCheck: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
});
