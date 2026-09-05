import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ScheduleBlock } from "../types/database";
import { minutesToTime } from "../lib/time";
import {
  describeRecurrence,
  overrideDays,
  resolveBlockTimes,
} from "../lib/recurrence";
import { WEEKDAYS } from "../lib/schedule";
import { Colors, spacing, radii, iconSizes } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { hapticSelect } from "../lib/haptics";

function weekdayLong(day: number): string {
  return WEEKDAYS[day]
    ? new Date(2026, 0, 4 + day).toLocaleDateString("en-US", { weekday: "long" })
    : "?";
}

function overrideSummary(
  overrides: NonNullable<ScheduleBlock["time_overrides"]>
): string {
  const groups = new Map<number, number[]>();
  for (const day of overrideDays(overrides)) {
    const start = overrides[String(day)]?.start;
    if (start == null) continue;
    const days = groups.get(start) ?? [];
    days.push(day);
    groups.set(start, days);
  }
  return [...groups.entries()]
    .map(([start, days]) => {
      const names = days.map((d) => `${weekdayLong(d)}s`).join(", ");
      return `${minutesToTime(start)} ${names}`;
    })
    .join(" · ");
}

interface ScheduleBlockCardProps {
  block: ScheduleBlock;
  selectedDay?: number | null;
  onEdit: (b: ScheduleBlock) => void;
  onArchive: (block: ScheduleBlock) => void;
  disabled: boolean;
}

export const ScheduleBlockCard = React.memo(function ScheduleBlockCard({
  block,
  selectedDay = null,
  onEdit,
  onArchive,
  disabled,
}: ScheduleBlockCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const times =
    selectedDay != null
      ? resolveBlockTimes(block, selectedDay)
      : { start: block.start_minutes, end: block.end_minutes };
  const dayHasOverride =
    selectedDay != null && block.time_overrides?.[String(selectedDay)] != null;
  const allViewSummary =
    selectedDay == null && block.time_overrides
      ? overrideSummary(block.time_overrides)
      : "";

  return (
    <PressableScale
      variant="highlight"
      baseColor={colors.surface}
      highlightColor={colors.surfaceNested}
      style={[styles.blockCard, !block.is_active && styles.blockCardArchived]}
      onPress={() => {
        if (block.is_active) {
          hapticSelect();
          onEdit(block);
        }
      }}
      disabled={disabled || !block.is_active}
    >
      <View style={styles.blockHeader}>
        <Text style={styles.blockName} numberOfLines={1}>
          {block.name}
        </Text>
        <View style={styles.blockActions}>
          {block.is_active ? (
            <TouchableOpacity
              onPress={() => {
                hapticSelect();
                onEdit(block);
              }}
              disabled={disabled}
            >
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => {
              hapticSelect();
              onArchive(block);
            }}
            disabled={disabled}
          >
            <Text style={styles.archiveText}>
              {block.is_active ? "Archive" : "Restore"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.blockMeta}>
        {minutesToTime(times.start)} – {minutesToTime(times.end)}
        {allViewSummary ? ` · ${allViewSummary}` : ""}
        {" · "}
        {block.category.replace("_", " ")}
        {block.is_fixed ? (
          <>
            {" · "}
            <Feather name="lock" size={iconSizes.sm} color={colors.textMuted} />
            {" Fixed"}
          </>
        ) : null}
      </Text>
      {dayHasOverride ? (
        <View style={styles.differentTag}>
          <Text style={styles.differentTagText}>different today</Text>
        </View>
      ) : null}
      <Text style={styles.blockRepeats}>
        Repeats: {describeRecurrence(block.days_of_week, block.interval_weeks ?? 1, block.ends_on)}
      </Text>
    </PressableScale>
  );
});

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    blockCard: {
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: 10,
    },
    blockCardArchived: {
      opacity: 0.55,
    },
    blockHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    blockName: {
      flex: 1,
      marginRight: spacing.md,
      color: c.text,
      fontSize: 16,
      fontWeight: "600",
    },
    blockActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flexShrink: 0,
    },
    editText: { color: c.primary, fontSize: 13, fontWeight: "600" },
    archiveText: { color: c.textSecondary, fontSize: 13, fontWeight: "600" },
    blockMeta: { color: c.textMuted, fontSize: 13, marginTop: spacing.xs },
    differentTag: {
      alignSelf: "flex-start",
      marginTop: spacing.xs,
      backgroundColor: c.primaryTint,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.sm,
    },
    differentTagText: {
      color: c.text,
      fontSize: 11,
      fontWeight: "600",
    },
    blockRepeats: { color: c.textFaint, fontSize: 12, marginTop: 4, marginBottom: 10 },
  });
