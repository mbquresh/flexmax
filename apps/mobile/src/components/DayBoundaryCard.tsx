import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { Colors, spacing, radii, typography, iconSizes } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";

interface Props {
  sleepTargetMinutes: number;
  wakeTargetMinutes: number;
  sleptAt: number | null;
  wokeAt: number | null;
  onSaveSleep: (actualMinutes: number) => void;
  onSaveWake: (wakeMinutes: number) => void;
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

function sleepWallClockToMinutes(date: Date): number {
  const picked = date.getHours() * 60 + date.getMinutes();
  return picked < 720 ? picked + 1440 : picked;
}

function wakeWallClockToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function bucketLabel(m: number, target: number): string {
  const base = `~${label(m)}`;
  return m === target ? `${base} (on time)` : base;
}

export function DayBoundaryCard({
  sleepTargetMinutes,
  wakeTargetMinutes,
  sleptAt,
  wokeAt,
  onSaveSleep,
  onSaveWake,
  onDismiss,
  saving,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [showSleepExact, setShowSleepExact] = useState(false);
  const [showWakeExact, setShowWakeExact] = useState(false);
  const [sleepPickerDate, setSleepPickerDate] = useState(() =>
    minutesToDate(sleepTargetMinutes)
  );
  const [wakePickerDate, setWakePickerDate] = useState(() =>
    minutesToDate(wakeTargetMinutes)
  );

  const sleepBuckets = [
    sleepTargetMinutes,
    sleepTargetMinutes + 120,
    sleepTargetMinutes + 240,
  ];
  const wakeBuckets = [
    wakeTargetMinutes,
    wakeTargetMinutes + 120,
    wakeTargetMinutes + 240,
  ];

  const handleSleepPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setShowSleepExact(false);
      if (event.type === "set" && selected) {
        onSaveSleep(sleepWallClockToMinutes(selected));
      }
      return;
    }
    if (selected) {
      setSleepPickerDate(selected);
    }
  };

  const handleWakePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setShowWakeExact(false);
      if (event.type === "set" && selected) {
        onSaveWake(wakeWallClockToMinutes(selected));
      }
      return;
    }
    if (selected) {
      setWakePickerDate(selected);
    }
  };

  return (
    <View style={styles.card}>
      {sleptAt != null ? (
        <Text style={styles.answered}>
          Last night · Got to bed {label(sleptAt)}
        </Text>
      ) : (
        <>
          <Text style={styles.eyebrow}>Last night</Text>
          <Text style={styles.question}>When did you get to bed?</Text>
          <View style={styles.bucketRow}>
            {sleepBuckets.map((m) => (
              <TouchableOpacity
                key={`sleep-${m}`}
                style={styles.bucket}
                onPress={() => onSaveSleep(m)}
                disabled={saving}
                activeOpacity={0.7}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.bucketText}>{bucketLabel(m, sleepTargetMinutes)}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => {
              setSleepPickerDate(minutesToDate(sleepTargetMinutes));
              setShowSleepExact(true);
            }}
            disabled={saving}
          >
            <Text style={styles.exactLink}>set exact time</Text>
          </TouchableOpacity>
          {showSleepExact ? (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={sleepPickerDate}
                mode="time"
                is24Hour={false}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleSleepPickerChange}
                textColor={colors.text}
              />
              {Platform.OS === "ios" ? (
                <PressableScale
                  style={styles.doneBtn}
                  onPress={() => onSaveSleep(sleepWallClockToMinutes(sleepPickerDate))}
                  disabled={saving}
                >
                  <Text style={styles.doneText}>Done</Text>
                </PressableScale>
              ) : null}
            </View>
          ) : null}
        </>
      )}

      <View style={styles.sectionGap} />

      {wokeAt != null ? (
        <Text style={styles.answered}>
          This morning · Got up {label(wokeAt)}
        </Text>
      ) : (
        <>
          <Text style={styles.eyebrow}>This morning</Text>
          <Text style={styles.question}>When did you get up?</Text>
          <View style={styles.bucketRow}>
            {wakeBuckets.map((m) => (
              <TouchableOpacity
                key={`wake-${m}`}
                style={styles.bucket}
                onPress={() => onSaveWake(m)}
                disabled={saving}
                activeOpacity={0.7}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.bucketText}>{bucketLabel(m, wakeTargetMinutes)}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => {
              setWakePickerDate(minutesToDate(wakeTargetMinutes));
              setShowWakeExact(true);
            }}
            disabled={saving}
          >
            <Text style={styles.exactLink}>set exact time</Text>
          </TouchableOpacity>
          {showWakeExact ? (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={wakePickerDate}
                mode="time"
                is24Hour={false}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleWakePickerChange}
                textColor={colors.text}
              />
              {Platform.OS === "ios" ? (
                <PressableScale
                  style={styles.doneBtn}
                  onPress={() => onSaveWake(wakeWallClockToMinutes(wakePickerDate))}
                  disabled={saving}
                >
                  <Text style={styles.doneText}>Done</Text>
                </PressableScale>
              ) : null}
            </View>
          ) : null}
        </>
      )}

      <View style={styles.footer}>
        <View />
        <TouchableOpacity onPress={onDismiss} disabled={saving} hitSlop={8}>
          <Feather name="x" size={iconSizes.md} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      marginHorizontal: spacing.xl,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
      backgroundColor: c.surface,
      borderRadius: radii.xl,
      padding: spacing.lg,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    sectionGap: {
      height: spacing.lg,
    },
    eyebrow: {
      color: c.textMuted,
      ...typography.caption,
      marginBottom: spacing.xs,
    },
    question: {
      color: c.text,
      ...typography.bodyBold,
      marginBottom: spacing.md,
    },
    answered: {
      color: c.textFaint,
      ...typography.small,
    },
    bucketRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    bucket: {
      flex: 1,
      backgroundColor: c.surfaceNested,
      borderRadius: radii.lg,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
    },
    bucketText: {
      color: c.text,
      ...typography.smallBold,
      textAlign: "center",
    },
    exactLink: {
      color: c.primary,
      ...typography.caption,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.md,
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
