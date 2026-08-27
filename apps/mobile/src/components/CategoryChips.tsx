import React, { useMemo } from "react";
import { ScrollView, Text, TouchableOpacity, StyleSheet } from "react-native";
import { BlockCategory } from "../types/database";
import { Colors, spacing, radii } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

export const CATEGORY_OPTIONS: { value: BlockCategory; label: string }[] = [
  { value: "deep_work", label: "Deep work" },
  { value: "health", label: "Health" },
  { value: "morning_routine", label: "Morning" },
  { value: "wind_down", label: "Wind down" },
  { value: "learning", label: "Learning" },
  { value: "admin", label: "Admin" },
  { value: "other", label: "Other" },
];

interface CategoryChipsProps {
  value: BlockCategory;
  onChange: (v: BlockCategory) => void;
}

export function CategoryChips({ value, onChange }: CategoryChipsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
      {CATEGORY_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.chip, value === opt.value && styles.chipActive]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.chipText, value === opt.value && styles.chipTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    chipRow: { flexGrow: 0 },
    chip: {
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginRight: spacing.sm,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { color: c.textMuted, fontSize: 13 },
    chipTextActive: { color: c.onPrimary },
  });
