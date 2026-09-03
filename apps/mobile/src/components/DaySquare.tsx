import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, radii, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

export function segmentHeightPct(ratio: number): number {
  if (ratio <= 0) return 0;
  return Math.max(12, Math.round(ratio * 100));
}

interface DaySquareProps {
  letter: string;
  completionRatio: number;
  missedRatio: number;
  isToday?: boolean;
  isFuture?: boolean;
  /** A past day currently open on Today. */
  isSelected?: boolean;
}

export function DaySquare({
  letter,
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
  const isFilledOut = combinedRatio >= 1;

  return (
    <View style={[styles.daySquare, isFuture && styles.daySquareFuture]}>
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
      <View style={styles.dayLetterWrap}>
        <Text
          style={[
            styles.daySquareLetter,
            isFilledOut && styles.daySquareLetterDone,
            isFuture && styles.daySquareLetterFuture,
          ]}
        >
          {letter}
        </Text>
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
    fill: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
    },
    dayLetterWrap: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
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
    daySquareLetter: {
      color: c.streakMuted,
      ...typography.smallBold,
    },
    daySquareLetterDone: {
      color: c.text,
    },
    daySquareLetterFuture: {
      color: c.streakMuted,
    },
  });
