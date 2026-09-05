import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { WEEKDAYS } from "./DayChips";
import { Colors, radii, spacing, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { hapticSelect } from "../lib/haptics";

interface DayStripProps {
  value: number | null;
  onChange: (v: number | null) => void;
}

export function DayStrip({ value, onChange }: DayStripProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const select = (next: number | null) => {
    if (next === value) return;
    hapticSelect();
    onChange(next);
  };

  return (
    <View style={styles.row}>
      <PressableScale
        style={[styles.seg, styles.allSeg, value === null && styles.segSelected]}
        onPress={() => select(null)}
      >
        <Text style={[styles.segText, value === null && styles.segTextSelected]}>
          All
        </Text>
      </PressableScale>
      {WEEKDAYS.map((day) => {
        const selected = value === day.value;
        return (
          <PressableScale
            key={day.value}
            style={[styles.seg, selected && styles.segSelected]}
            onPress={() => select(day.value)}
          >
            <Text style={[styles.segText, selected && styles.segTextSelected]}>
              {day.label[0]}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 4,
      marginBottom: spacing.lg,
    },
    seg: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.sm,
      borderRadius: radii.sm,
      backgroundColor: c.surfaceNested,
    },
    allSeg: { flex: 1.4 },
    segSelected: { backgroundColor: c.primaryTint },
    segText: { ...typography.smallBold, color: c.textSecondary },
    segTextSelected: { color: c.text },
  });
