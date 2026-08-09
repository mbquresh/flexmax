import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { DailyInstance } from "../types/database";
import { minutesToTime } from "../lib/time";
import { Colors, spacing, radii } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";

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
    status: "completed" | "missed"
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
            <PressableScale
              key={label}
              variant="highlight"
              baseColor={colors.surface}
              highlightColor={colors.surfaceNested}
              style={styles.presetBtn}
              onPress={() => onPresetTap(instance.id, label)}
            >
              <Text style={styles.presetBtnText}>{label}</Text>
            </PressableScale>
          ))}
        </View>
        <PressableScale
          variant="highlight"
          baseColor={colors.surface}
          highlightColor={colors.surfaceNested}
          onPress={() => {
            setPresetsDismissed(true);
            onPresetSkip(instance.id);
          }}
          hitSlop={8}
        >
          <Text style={styles.skipLink}>skip</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={styles.blockName}>{blockName}</Text>
      <Text style={styles.blockTime}>{timeRange}</Text>
      <View style={styles.actionRow}>
        <PressableScale
          variant="highlight"
          baseColor={colors.surface}
          highlightColor={colors.surfaceNested}
          style={[styles.actionBtn, styles.doneBtn]}
          onPress={() => onStatusTap(instance.id, "completed")}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </PressableScale>
        <PressableScale
          variant="highlight"
          baseColor={colors.surface}
          highlightColor={colors.surfaceNested}
          style={[styles.actionBtn, styles.neutralBtn]}
          onPress={() => onStatusTap(instance.id, "missed")}
        >
          <Text style={styles.neutralBtnText}>Missed</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    row: {
      backgroundColor: c.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    blockName: {
      color: c.text,
      fontSize: 16,
      fontWeight: "600",
    },
    blockTime: {
      color: c.textMuted,
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
      borderColor: c.success,
    },
    doneBtnText: {
      color: c.text,
      fontSize: 13,
      fontWeight: "600",
    },
    neutralBtn: {
      borderColor: c.border,
    },
    neutralBtnText: {
      color: c.textSecondary,
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
      color: c.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    presetWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    presetBtn: {
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    presetBtnText: {
      color: c.textSecondary,
      fontSize: 13,
    },
    skipLink: {
      color: c.textFaint,
      fontSize: 13,
      alignSelf: "flex-start",
    },
  });
