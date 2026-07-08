import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  Modal,
  StyleSheet,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { colors, spacing, radii, typography } from "../theme";
import { minutesToTime } from "../lib/time";

interface Props {
  label: string;
  valueMinutes: number;
  onChange: (minutes: number) => void;
}

function minutesToDate(m: number): Date {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

function dateToMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function TimePicker({ label, valueMinutes, onChange }: Props) {
  const [showAndroid, setShowAndroid] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);

  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setShowAndroid(false);
      if (selected) onChange(dateToMinutes(selected));
    } else if (selected) {
      onChange(dateToMinutes(selected));
    }
  };

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={styles.pill}
        onPress={() => (Platform.OS === "android" ? setShowAndroid(true) : setIosOpen(true))}
        activeOpacity={0.7}
      >
        <Text style={styles.pillText}>{minutesToTime(valueMinutes)}</Text>
      </TouchableOpacity>

      {Platform.OS === "android" && showAndroid ? (
        <DateTimePicker
          value={minutesToDate(valueMinutes)}
          mode="time"
          is24Hour={false}
          display="clock"
          onChange={handleChange}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal
          visible={iosOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIosOpen(false)}
        >
          <View style={styles.iosOverlay}>
            <View style={styles.iosSheet}>
              <View style={styles.iosHeader}>
                <TouchableOpacity onPress={() => setIosOpen(false)}>
                  <Text style={styles.iosDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={minutesToDate(valueMinutes)}
                mode="time"
                is24Hour={false}
                display="spinner"
                onChange={handleChange}
                textColor={colors.text}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  label: { color: colors.textMuted, ...typography.body },
  pill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pillText: { color: colors.primary, ...typography.bodyBold },
  iosOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  iosSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingBottom: spacing.xxl,
  },
  iosHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  iosDone: { color: colors.primary, ...typography.bodyBold },
});
