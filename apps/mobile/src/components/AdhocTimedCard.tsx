import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AdhocTask } from "../types/database";
import { minutesToTime } from "../lib/time";
import { Colors, spacing, radii, iconSizes } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";

interface AdhocTimedCardProps {
  task: AdhocTask;
  onToggle: (task: AdhocTask) => void;
}

export function AdhocTimedCard({ task, onToggle }: AdhocTimedCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDone = task.status === "completed";

  return (
    <PressableScale
      variant="highlight"
      baseColor={colors.surface}
      highlightColor={colors.surfaceNested}
      style={[styles.card, isDone && styles.cardDone]}
      onPress={() => onToggle(task)}
    >
      <View style={styles.accent} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.name, isDone && styles.nameDone]} numberOfLines={2}>
            {task.name}
          </Text>
          <View style={[styles.actionCircle, isDone && styles.actionCircleDone]}>
            {isDone ? (
              <Feather name="check" size={iconSizes.md} color={colors.text} />
            ) : null}
          </View>
        </View>
        <Text style={styles.meta}>
          {minutesToTime(task.start_minutes!)} – {minutesToTime(task.end_minutes!)}
        </Text>
        <Text style={styles.tag}>One-off</Text>
      </View>
    </PressableScale>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      borderRadius: radii.lg,
      marginBottom: 10,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: c.dangerTint,
      ...c.shadowRest,
    },
    cardDone: {
      opacity: 0.55,
    },
    accent: {
      width: 4,
      backgroundColor: c.danger,
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
      color: c.text,
      fontSize: 16,
      fontWeight: "600",
    },
    nameDone: {
      textDecorationLine: "line-through",
      color: c.textMuted,
    },
    meta: {
      color: c.textMuted,
      fontSize: 13,
    },
    tag: {
      alignSelf: "flex-start",
      color: c.danger,
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
      borderColor: c.danger,
      alignItems: "center",
      justifyContent: "center",
    },
    actionCircleDone: {
      borderColor: c.success,
      backgroundColor: c.success,
    },
  });
