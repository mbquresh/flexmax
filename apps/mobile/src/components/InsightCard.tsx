import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BehavioralInsight } from "../types/database";
import { Colors, spacing, radii, iconSizes, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";

interface Props {
  insight: BehavioralInsight;
  onDismiss: () => void;
}

export function InsightCard({ insight, onDismiss }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <PressableScale
      variant="highlight"
      baseColor={colors.surface}
      highlightColor={colors.surfaceNested}
      style={styles.card}
    >
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
    </PressableScale>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      borderRadius: radii.xl,
      padding: spacing.xxl,
      marginBottom: spacing.lg,
      borderLeftWidth: 3,
      borderLeftColor: c.primary,
      ...c.shadowRest,
    },
    label: {
      color: c.textMuted,
      ...typography.label,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
      paddingRight: spacing.xxl,
    },
    belief: {
      color: c.text,
      ...typography.body,
    },
    divider: {
      height: 0.5,
      backgroundColor: c.border,
      marginVertical: spacing.lg,
    },
    suggestion: {
      color: c.textSecondary,
      ...typography.smallRelaxed,
    },
    dismiss: {
      position: "absolute",
      top: spacing.xxl,
      right: spacing.xxl,
    },
  });
