import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import {
  TimePeriod,
  clampHour,
  clampMinute,
  partsToTime,
  timeToParts,
} from "../lib/time";

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
  wrap: { flex: 1 },
  label: { color: "#888", fontSize: 12, marginBottom: 6, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  part: {
    width: 44,
    backgroundColor: "#1a1a1a",
    borderWidth: 0.5,
    borderColor: "#333",
    borderRadius: 10,
    paddingVertical: 10,
    color: "#f0f0f0",
    fontSize: 16,
    textAlign: "center",
  },
  colon: { color: "#888", fontSize: 18, paddingHorizontal: 2 },
  periodRow: { flexDirection: "row", marginLeft: 6, gap: 4 },
  periodBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#1a1a1a",
    borderWidth: 0.5,
    borderColor: "#333",
  },
  periodBtnActive: { backgroundColor: "#534AB7", borderColor: "#534AB7" },
  periodText: { color: "#888", fontSize: 13, fontWeight: "600" },
  periodTextActive: { color: "#EEEDFE" },
});
