import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { WEEKDAYS } from "../lib/schedule";
import { Colors, spacing, radii } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

export { WEEKDAYS, ALL_DAYS } from "../lib/schedule";

interface DayChipsProps {
  value: number[];
  onChange: (days: number[]) => void;
}

export function DayChips({ value, onChange }: DayChipsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const toggleDay = (day: number) => {
    onChange(
      value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b)
    );
  };

  return (
    <View style={styles.dayRow}>
      {WEEKDAYS.map((day) => {
        const active = value.includes(day.value);
        return (
          <TouchableOpacity
            key={day.value}
            style={[styles.dayChip, active && styles.dayChipActive]}
            onPress={() => toggleDay(day.value)}
          >
            <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
              {day.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    dayRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    dayChip: {
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    dayChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    dayChipText: { color: c.textFaint, fontSize: 12, fontWeight: "600" },
    dayChipTextActive: { color: c.onPrimary },
  });
