import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BehavioralInsight } from "../types/database";
import { colors, spacing, radii, iconSizes, typography } from "../theme";

interface Props {
  insight: BehavioralInsight;
  onDismiss: () => void;
}

export function InsightCard({ insight, onDismiss }: Props) {
  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.dismiss}
        onPress={onDismiss}
        hitSlop={8}
        accessibilityLabel="Dismiss insight"
      >
        <Feather name="x" size={iconSizes.lg} color={colors.textMuted} />
      </TouchableOpacity>

      <Text style={styles.label}>What I'm seeing</Text>
      <Text style={styles.belief}>{insight.belief}</Text>

      {insight.suggestion ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.suggestion}>{insight.suggestion}</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xxl,
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  label: {
    color: colors.textMuted,
    ...typography.label,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
    paddingRight: spacing.xxl,
  },
  belief: {
    color: colors.text,
    ...typography.body,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  suggestion: {
    color: colors.textSecondary,
    ...typography.smallRelaxed,
  },
  dismiss: {
    position: "absolute",
    top: spacing.xxl,
    right: spacing.xxl,
  },
});
