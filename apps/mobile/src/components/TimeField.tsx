import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import {
  TimePeriod,
  clampHour,
  clampMinute,
  partsToTime,
  timeToParts,
} from "../lib/time";
import { colors, spacing, radii, typography } from "../theme";

interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const parsed = timeToParts(value);
  const [hour, setHour] = useState(String(parsed.hour));
  const [minute, setMinute] = useState(parsed.minute.toString().padStart(2, "0"));
  const [period, setPeriod] = useState<TimePeriod>(parsed.period);

  useEffect(() => {
    const next = timeToParts(value);
    setHour(String(next.hour));
    setMinute(next.minute.toString().padStart(2, "0"));
    setPeriod(next.period);
  }, [value]);

  const commit = (
    nextHour: string,
    nextMinute: string,
    nextPeriod: TimePeriod
  ) => {
    const h = clampHour(Number(nextHour));
    const m = clampMinute(Number(nextMinute));
    setHour(String(h));
    setMinute(m.toString().padStart(2, "0"));
    setPeriod(nextPeriod);
    onChange(partsToTime(h, m, nextPeriod));
  };

  const handleHourChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 2);
    setHour(digits);
  };

  const handleMinuteChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 2);
    setMinute(digits);
    if (digits.length === 2) {
      commit(hour, digits, period);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.part}
          value={hour}
          onChangeText={handleHourChange}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
          onBlur={() => commit(hour, minute, period)}
          onEndEditing={() => commit(hour, minute, period)}
        />
        <Text style={styles.colon}>:</Text>
        <TextInput
          style={styles.part}
          value={minute}
          onChangeText={handleMinuteChange}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
          onBlur={() => commit(hour, minute, period)}
          onEndEditing={() => commit(hour, minute, period)}
        />
        <View style={styles.periodRow}>
          {(["AM", "PM"] as TimePeriod[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => commit(hour, minute, p)}
            >
              <Text
                style={[styles.periodText, period === p && styles.periodTextActive]}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: 6, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.xs },
  part: {
    width: 40,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 16,
    textAlign: "center",
  },
  colon: { color: colors.textMuted, fontSize: 16, paddingHorizontal: 2 },
  periodRow: { flexDirection: "row", marginLeft: spacing.xs, gap: spacing.xs },
  periodBtn: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  periodBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodText: { color: colors.textMuted, ...typography.smallBold },
  periodTextActive: { color: colors.onPrimary },
});
