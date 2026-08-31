import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ScheduleBlock } from "../types/database";
import { minutesToTime } from "../lib/time";
import { describeRecurrence } from "../lib/recurrence";
import { Colors, spacing, radii, iconSizes } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";

interface ScheduleBlockCardProps {
  block: ScheduleBlock;
  onEdit: (b: ScheduleBlock) => void;
  onArchive: (block: ScheduleBlock) => void;
  disabled: boolean;
}

export const ScheduleBlockCard = React.memo(function ScheduleBlockCard({
  block,
  onEdit,
  onArchive,
  disabled,
}: ScheduleBlockCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <PressableScale
      variant="highlight"
      baseColor={colors.surface}
      highlightColor={colors.surfaceNested}
      style={[styles.blockCard, !block.is_active && styles.blockCardArchived]}
      onPress={() => {
        if (block.is_active) onEdit(block);
      }}
      disabled={disabled || !block.is_active}
    >
      <View style={styles.blockHeader}>
        <Text style={styles.blockName} numberOfLines={1}>
          {block.name}
        </Text>
        <View style={styles.blockActions}>
          {block.is_active ? (
            <TouchableOpacity onPress={() => onEdit(block)} disabled={disabled}>
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => onArchive(block)} disabled={disabled}>
            <Text style={styles.archiveText}>
              {block.is_active ? "Archive" : "Restore"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.blockMeta}>
        {minutesToTime(block.start_minutes)} – {minutesToTime(block.end_minutes)} ·{" "}
        {block.category.replace("_", " ")}
        {block.is_fixed ? (
          <>
            {" · "}
            <Feather name="lock" size={iconSizes.sm} color={colors.textMuted} />
            {" Fixed"}
          </>
        ) : null}
      </Text>
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
    blockRepeats: { color: c.textFaint, fontSize: 12, marginTop: 4, marginBottom: 10 },
  });
