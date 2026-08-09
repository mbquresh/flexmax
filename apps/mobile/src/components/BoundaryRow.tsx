import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { minutesToTime } from "../lib/time";
import { Colors, spacing, radii, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

interface BoundaryRowProps {
  label: string;
  minutes: number | null;
  onChange: (m: number) => void;
}

function minutesToDate(m: number): Date {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function BoundaryRow({ label, minutes, onChange }: BoundaryRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(() =>
    minutesToDate(minutes ?? 6 * 60)
  );

  const openPicker = () => {
    setPickerDate(minutesToDate(minutes ?? 6 * 60));
    setShowPicker(true);
  };

  const applyPickedTime = (date: Date) => {
    onChange(dateToMinutes(date));
    if (Platform.OS === "android") {
      setShowPicker(false);
    }
  };

  const handlePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
      if (event.type === "set" && selected) {
        applyPickedTime(selected);
      }
      return;
    }
    if (selected) {
      setPickerDate(selected);
    }
  };

  return (
    <View>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={openPicker}
      >
        <Text style={styles.label}>{label}</Text>
        <View style={styles.right}>
          <Text style={minutes == null ? styles.placeholder : styles.time}>
            {minutes == null ? "Set" : minutesToTime(minutes)}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </Pressable>

      {showPicker ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={pickerDate}
            mode="time"
            is24Hour={false}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handlePickerChange}
            textColor={colors.text}
          />
          {Platform.OS === "ios" ? (
            <Pressable
              style={styles.doneBtn}
              onPress={() => {
                applyPickedTime(pickerDate);
                setShowPicker(false);
              }}
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.surface,
      borderRadius: radii.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
    },
    rowPressed: {
      opacity: 0.85,
    },
    label: {
      color: c.text,
      ...typography.bodyBold,
    },
    right: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    time: {
      color: c.primary,
      ...typography.bodyBold,
    },
    placeholder: {
      color: c.textMuted,
      ...typography.body,
    },
    chevron: {
      color: c.primary,
      fontSize: 18,
      lineHeight: 20,
    },
    pickerWrap: {
      marginTop: spacing.sm,
    },
    doneBtn: {
      alignSelf: "flex-end",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    doneText: {
      color: c.primary,
      ...typography.bodyBold,
    },
  });
