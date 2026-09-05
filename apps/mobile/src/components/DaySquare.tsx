import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, numeric, radii, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

export function segmentHeightPct(ratio: number): number {
  if (ratio <= 0) return 0;
  return Math.max(12, Math.round(ratio * 100));
}

/** Monday-first, matching weekDates. */
export const WEEK_STRIP_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

interface DaySquareProps {
  weekday: string;
  date?: number;
  completionRatio: number;
  missedRatio: number;
  isToday?: boolean;
  isFuture?: boolean;
  /** A past day currently open on Today. */
  isSelected?: boolean;
}

export function DaySquare({
  weekday,
  date,
  completionRatio,
  missedRatio,
  isToday = false,
  isFuture = false,
  isSelected = false,
}: DaySquareProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const combinedRatio = completionRatio + missedRatio;
  const combinedPct = segmentHeightPct(combinedRatio);
  const completedPct = segmentHeightPct(completionRatio);

  return (
    <View
      style={[
        styles.daySquare,
        (isToday || isSelected) && styles.daySquareActive,
        isFuture && styles.daySquareFuture,
      ]}
    >
      {combinedPct > 0 ? (
        <View
          style={[
            styles.fill,
            {
              height: `${combinedPct}%`,
              backgroundColor: colors.streakMissed,
            },
          ]}
        />
      ) : null}
      {completedPct > 0 ? (
        <View
          style={[
            styles.fill,
            {
              height: `${completedPct}%`,
              backgroundColor: colors.streak,
            },
          ]}
        />
      ) : null}
      {isToday ? <View style={styles.todayRing} pointerEvents="none" /> : null}
      {isSelected ? <View style={styles.selectedRing} pointerEvents="none" /> : null}
      <View style={styles.labelWrap}>
        <Text
          style={[
            styles.weekday,
            isFuture && styles.weekdayFuture,
          ]}
        >
          {weekday}
        </Text>
        {date != null ? (
          <Text
            style={[
              styles.date,
              isFuture && styles.dateFuture,
            ]}
          >
            {date}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export const daySquareStripStyles = StyleSheet.create({
  weekStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  dayHit: {
    flex: 1,
  },
});

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    daySquare: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: radii.sm,
      backgroundColor: c.streakSquare,
      overflow: "hidden",
    },
    daySquareActive: {
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    fill: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
    },
    labelWrap: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
    },
    todayRing: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderWidth: 1.5,
      borderColor: c.streak,
      borderRadius: radii.sm,
    },
    // Not teal. The teal ring means today; a selected past day is a
    // different statement and must not be mistaken for the protected one.
    selectedRing: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderWidth: 1.5,
      borderColor: c.primary,
      borderRadius: radii.sm,
    },
    daySquareFuture: {
      backgroundColor: c.streakSquare,
    },
    weekday: {
      color: c.primary,
      ...typography.label,
      letterSpacing: 0,
    },
    weekdayFuture: {
      opacity: 0.45,
    },
    date: {
      color: c.text,
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: -0.3,
      lineHeight: 18,
      ...numeric,
    },
    dateFuture: {
      color: c.textFaint,
    },
  });
