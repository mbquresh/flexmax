import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radii, typography } from "../theme";

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
}

export function DaySquare({
  letter,
  completionRatio,
  missedRatio,
  isToday = false,
  isFuture = false,
}: DaySquareProps) {
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

const styles = StyleSheet.create({
  daySquare: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.streakSquare,
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
    borderColor: colors.streak,
    borderRadius: radii.sm,
  },
  daySquareFuture: {
    backgroundColor: colors.streakSquare,
  },
  daySquareLetter: {
    color: colors.streakMuted,
    ...typography.smallBold,
  },
  daySquareLetterDone: {
    color: colors.text,
  },
  daySquareLetterFuture: {
    color: colors.streakMuted,
  },
});
