import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { ScheduleBlock } from "../types/database";
import { Colors, spacing, radii, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { formatDayLabel, getLocalDateString, getTomorrowLocalDateString } from "../lib/time";
import { hapticSelect } from "../lib/haptics";
import { PressableScale } from "./PressableScale";
import { BrandLoader } from "./BrandLoader";

function chipLabel(dateStr: string): string {
  if (dateStr === getLocalDateString()) return "Today";
  if (dateStr === getTomorrowLocalDateString()) return "Tomorrow";
  return formatDayLabel(dateStr);
}

interface TaskMovePickerProps {
  dateOptions: string[];
  destBlocks: ScheduleBlock[];
  moveDate: string | null;
  moveBlockId: string | null;
  homeBlockId: string;
  canMove: boolean;
  canEdit: boolean;
  saving: boolean;
  onPickDate: (date: string) => void;
  onPickBlock: (blockId: string) => void;
  onMove: () => void;
}

export function TaskMovePicker({
  dateOptions,
  destBlocks,
  moveDate,
  moveBlockId,
  homeBlockId,
  canMove,
  canEdit,
  saving,
  onPickDate,
  onPickBlock,
  onMove,
}: TaskMovePickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (dateOptions.length === 0) {
    return (
      <Text style={styles.moveHint}>
        This block does not run again soon enough to move the task.
      </Text>
    );
  }

  return (
    <View style={styles.moveBox}>
      <Text style={styles.moveLabel}>Move to</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {dateOptions.map((d) => (
          <PressableScale
            key={d}
            style={[styles.chip, moveDate === d && styles.chipOn]}
            onPress={() => {
              hapticSelect();
              onPickDate(d);
            }}
          >
            <Text style={[styles.chipText, moveDate === d && styles.chipTextOn]}>
              {chipLabel(d)}
            </Text>
          </PressableScale>
        ))}
      </ScrollView>
      {destBlocks.map((b) => (
        <PressableScale
          key={b.id}
          style={[styles.blockPick, moveBlockId === b.id && styles.chipOn]}
          onPress={() => {
            hapticSelect();
            onPickBlock(b.id);
          }}
        >
          <Text
            style={[styles.chipText, moveBlockId === b.id && styles.chipTextOn]}
          >
            {b.name}
            {b.id === homeBlockId ? " (same)" : ""}
          </Text>
        </PressableScale>
      ))}
      <PressableScale
        style={[styles.primaryBtn, (!canMove || !canEdit) && styles.btnDisabled]}
        onPress={onMove}
        disabled={saving || !canMove || !canEdit}
      >
        {saving ? (
          <BrandLoader size={20} />
        ) : (
          <Text style={styles.primaryBtnText}>Move task</Text>
        )}
      </PressableScale>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    moveBox: { gap: spacing.sm },
    moveLabel: {
      color: c.textMuted,
      ...typography.caption,
      textTransform: "uppercase",
    },
    moveHint: {
      color: c.textMuted,
      ...typography.small,
    },
    chipRow: { gap: spacing.sm },
    chip: {
      backgroundColor: c.surfaceNested,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    chipOn: { backgroundColor: c.primaryTint },
    chipText: { color: c.text, ...typography.small },
    chipTextOn: { color: c.primary, ...typography.smallBold },
    blockPick: {
      backgroundColor: c.surfaceNested,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    primaryBtnText: {
      ...typography.bodyBold,
      color: c.onPrimary,
    },
    btnDisabled: { opacity: 0.5 },
  });
