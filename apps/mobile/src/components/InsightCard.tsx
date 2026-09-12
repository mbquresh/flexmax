import React, { useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BehavioralInsight } from "../types/database";
import { Colors, spacing, radii, iconSizes, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { CheckEngineIcon } from "./CheckEngineIcon";
import { insightTone } from "../lib/insightTone";
import { track } from "../lib/analytics";

interface Props {
  insight: BehavioralInsight;
  onDismiss: () => void;
  onOpen: () => void;
}

export function InsightCard({ insight, onDismiss, onOpen }: Props) {
  const { colors } = useTheme();
  const tone = insightTone(insight.kind, colors);
  const isEngine = insight.kind === "structural";
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    track("insight_viewed", { kind: insight.kind, rank: insight.rank });
  }, [insight.id, insight.kind, insight.rank]);

  return (
    <PressableScale
      variant="highlight"
      baseColor={isEngine ? tone.tint : colors.surface}
      highlightColor={colors.surfaceNested}
      style={[styles.card, { borderLeftColor: tone.stripe }]}
      accessibilityRole="button"
      accessibilityLabel="Open Theory of You"
      onPress={onOpen}
    >
      <TouchableOpacity
        style={styles.dismiss}
        onPress={onDismiss}
        hitSlop={8}
        accessibilityLabel="Dismiss insight"
      >
        <Feather name="x" size={iconSizes.lg} color={colors.textMuted} />
      </TouchableOpacity>

      {isEngine ? (
        <View style={styles.engineLabel}>
          <CheckEngineIcon size={20} color={tone.ink} />
          <Text style={[styles.label, { color: tone.ink, marginBottom: 0 }]}>
            Check engine
          </Text>
        </View>
      ) : (
        <Text style={[styles.label, { color: tone.ink }]}>What I&apos;m seeing</Text>
      )}
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
      backgroundColor: c.surface,
      borderRadius: radii.xl,
      padding: spacing.xxl,
      marginBottom: spacing.lg,
      borderLeftWidth: 3,
      ...c.shadowRest,
    },
    engineLabel: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
      paddingRight: spacing.xxl,
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
