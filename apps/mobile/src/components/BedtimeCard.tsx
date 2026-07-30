import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { colors, spacing, radii, typography } from "../theme";

interface Props {
  targetMinutes: number;
  onSave: (actualMinutes: number) => void;
  onDismiss: () => void;
  saving: boolean;
}

function minutesToDate(m: number): Date {
  const t = m % 1440;
  const d = new Date();
  d.setHours(Math.floor(t / 60), t % 60, 0, 0);
  return d;
}

function label(m: number): string {
  const t = m % 1440;
  const h24 = Math.floor(t / 60);
  const min = t % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? "am" : "pm";
  return min === 0 ? `${h12}${ampm}` : `${h12}:${String(min).padStart(2, "0")}${ampm}`;
}

function wallClockToActualMinutes(date: Date): number {
  const picked = date.getHours() * 60 + date.getMinutes();
  return picked < 720 ? picked + 1440 : picked;
}

export function BedtimeCard({ targetMinutes, onSave, onDismiss, saving }: Props) {
  const [showExact, setShowExact] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => minutesToDate(targetMinutes));

  const buckets = [targetMinutes, targetMinutes + 120, targetMinutes + 240];

  const bucketLabel = (m: number) => {
    const base = `~${label(m)}`;
    return m === targetMinutes ? `${base} (on time)` : base;
  };

  const applyPickedTime = (date: Date) => {
    onSave(wallClockToActualMinutes(date));
  };

  const handlePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setShowExact(false);
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
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Last night</Text>
      <Text style={styles.question}>When did you get to bed?</Text>

      <View style={styles.bucketRow}>
        {buckets.map((m) => (
          <TouchableOpacity
            key={m}
            style={styles.bucket}
            onPress={() => onSave(m)}
            disabled={saving}
            activeOpacity={0.7}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.bucketText}>{bucketLabel(m)}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => {
            setPickerDate(minutesToDate(targetMinutes));
            setShowExact(true);
          }}
          disabled={saving}
        >
          <Text style={styles.exactLink}>set exact time</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} disabled={saving} hitSlop={8}>
          <Text style={styles.dismiss}>✕</Text>
        </TouchableOpacity>
      </View>

      {showExact ? (
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
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => applyPickedTime(pickerDate)}
              disabled={saving}
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  eyebrow: {
    color: colors.textMuted,
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  question: {
    color: colors.text,
    ...typography.bodyBold,
    marginBottom: spacing.md,
  },
  bucketRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  bucket: {
    flex: 1,
    backgroundColor: colors.surfaceNested,
    borderRadius: radii.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  bucketText: {
    color: colors.text,
    ...typography.smallBold,
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  exactLink: {
    color: colors.primary,
    ...typography.caption,
  },
  dismiss: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 22,
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
    color: colors.primary,
    ...typography.bodyBold,
  },
});
