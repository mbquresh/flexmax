import React, { useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Colors, spacing, radii, iconSizes, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { TheoryKindMark } from "./TheoryKindMark";
import {
  THEORY_SECTION_COPY,
  THEORY_SECTION_ORDER,
  TheoryReportCounts,
} from "../lib/theory";
import { track } from "../lib/analytics";

interface Props {
  counts: TheoryReportCounts;
  synopsis: string;
  onDismiss: () => void;
  onOpen: () => void;
}

export function InsightCard({ counts, synopsis, onDismiss, onOpen }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    track("insight_viewed", {
      kind: "report",
      rank: 1,
      holding: counts.strength,
      engine: counts.structural,
      watching: counts.pattern,
      slipping: counts.causal,
    });
  }, [
    counts.strength,
    counts.structural,
    counts.pattern,
    counts.causal,
  ]);

  const present = THEORY_SECTION_ORDER.filter((kind) => counts[kind] > 0);
  const spoken = present
    .map((kind) => THEORY_SECTION_COPY[kind].title)
    .join(", ");

  return (
    <PressableScale
      variant="highlight"
      baseColor={colors.surface}
      highlightColor={colors.surfaceNested}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Report ready. ${spoken}. ${synopsis} Open Theory of You`}
      onPress={onOpen}
    >
      <TouchableOpacity
        style={styles.dismiss}
        onPress={onDismiss}
        hitSlop={8}
        accessibilityLabel="Dismiss report"
      >
        <Feather name="x" size={iconSizes.lg} color={colors.textMuted} />
      </TouchableOpacity>

      <View style={styles.heading}>
        <Text style={styles.label}>Report ready</Text>
        {present.map((kind) => (
          <TheoryKindMark
            key={kind}
            kind={kind}
            colors={colors}
            size={kind === "structural" ? 14.4 : 12}
          />
        ))}
      </View>

      {synopsis ? <Text style={styles.synopsis}>{synopsis}</Text> : null}
    </PressableScale>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radii.xl,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.xxl,
      marginBottom: spacing.lg,
      ...c.shadowRest,
    },
    heading: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.md,
      paddingRight: iconSizes.lg + spacing.md,
    },
    label: {
      color: c.textMuted,
      ...typography.label,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    synopsis: {
      color: c.text,
      ...typography.body,
    },
    dismiss: {
      position: "absolute",
      top: spacing.xl,
      right: spacing.xxl,
    },
  });
