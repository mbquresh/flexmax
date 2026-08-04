import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { DailyInstance } from "../types/database";
import { minutesToTime } from "../lib/time";
import { colors, spacing, radii } from "../theme";

const MISS_REASON_PRESETS = [
  "Ran out of time",
  "Low energy",
  "Something came up",
  "Chose something else",
  "Lost track of time",
] as const;

interface CloseTodayRowProps {
  instance: DailyInstance;
  onStatusTap: (
    instanceId: string,
    status: "completed" | "missed" | "skipped"
  ) => void;
  onPresetTap: (instanceId: string, tag: string) => void;
  onPresetSkip: (instanceId: string) => void;
}

export function CloseTodayRow({
  instance,
  onStatusTap,
  onPresetTap,
  onPresetSkip,
}: CloseTodayRowProps) {
  const [presetsDismissed, setPresetsDismissed] = useState(false);

  const blockName = instance.block?.name ?? "Block";
  const timeRange = `${minutesToTime(instance.start_minutes)} – ${minutesToTime(instance.end_minutes)}`;
  const showPresets =
    instance.status === "missed" &&
    !instance.miss_reason_tag &&
    !presetsDismissed;

  if (showPresets) {
    return (
      <View style={styles.row}>
        <View style={styles.presetHeader}>
          <Text style={styles.blockName}>{blockName}</Text>
          <Text style={styles.missedBadge}>Missed</Text>
        </View>
        <View style={styles.presetWrap}>
          {MISS_REASON_PRESETS.map((label) => (
            <TouchableOpacity
              key={label}
              style={styles.presetBtn}
              onPress={() => onPresetTap(instance.id, label)}
              activeOpacity={0.85}
            >
              <Text style={styles.presetBtnText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          onPress={() => {
            setPresetsDismissed(true);
            onPresetSkip(instance.id);
          }}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <Text style={styles.skipLink}>skip</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={styles.blockName}>{blockName}</Text>
      <Text style={styles.blockTime}>{timeRange}</Text>
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.doneBtn]}
          onPress={() => onStatusTap(instance.id, "completed")}
          activeOpacity={0.85}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.neutralBtn]}
          onPress={() => onStatusTap(instance.id, "missed")}
          activeOpacity={0.85}
        >
          <Text style={styles.neutralBtnText}>Missed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.neutralBtn]}
          onPress={() => onStatusTap(instance.id, "skipped")}
          activeOpacity={0.85}
        >
          <Text style={styles.neutralBtnText}>Skipped</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  blockName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  blockTime: {
    color: colors.textMuted,
    fontSize: 13,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  doneBtn: {
    backgroundColor: colors.successTint,
    borderColor: colors.success,
  },
  doneBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  neutralBtn: {
    backgroundColor: colors.surfaceNested,
    borderColor: colors.border,
  },
  neutralBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  presetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  missedBadge: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  presetWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  presetBtn: {
    backgroundColor: colors.surfaceNested,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  presetBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  skipLink: {
    color: colors.textFaint,
    fontSize: 13,
    alignSelf: "flex-start",
  },
});
