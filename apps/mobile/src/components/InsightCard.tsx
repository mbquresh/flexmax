import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { BehavioralInsight } from "../types/database";
import { colors, spacing, radii } from "../theme";

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
        <Text style={styles.dismissText}>✕</Text>
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
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    paddingRight: spacing.xxl,
  },
  belief: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  suggestion: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  dismiss: {
    position: "absolute",
    top: spacing.xxl,
    right: spacing.xxl,
  },
  dismissText: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 22,
  },
});
