import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { TodayStats } from "../lib/stats";
import { getLocalDateString } from "../lib/time";
import { colors, spacing, radii, typography } from "../theme";

interface StreakStripProps {
  stats: TodayStats;
  todayCompletionRatio?: number;
  todayMissedRatio?: number;
  liveCompletionRate?: number;
}

function getTodayWeekIndex(): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const todayStr = getLocalDateString(now);
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    if (getLocalDateString(day) === todayStr) return i;
  }
  return 0;
}

function segmentHeightPct(ratio: number): number {
  if (ratio <= 0) return 0;
  return Math.max(12, Math.round(ratio * 100));
}

export function StreakStrip({
  stats,
  todayCompletionRatio,
  todayMissedRatio,
  liveCompletionRate,
}: StreakStripProps) {
  const todayIndex = getTodayWeekIndex();
  const completionRate = liveCompletionRate ?? stats.completionRate;

  return (
    <View style={styles.streakContainer}>
      <View style={styles.streakHeader}>
        <Text style={styles.streakLabel}>
          {stats.streak > 0
            ? `${stats.streak}-day streak`
            : "Start your streak today"}
        </Text>
        <Text style={styles.streakSub}>{completionRate}% completed this week</Text>
      </View>
      <View style={styles.weekStrip}>
        {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => {
          const isToday = i === todayIndex;
          const completionRatio =
            isToday && todayCompletionRatio !== undefined
              ? todayCompletionRatio
              : stats.weekDayCompletionRatio[i];
          const missedRatio =
            isToday && todayMissedRatio !== undefined
              ? todayMissedRatio
              : stats.weekDayMissedRatio[i];
          const combinedRatio = completionRatio + missedRatio;
          const combinedPct = segmentHeightPct(combinedRatio);
          const completedPct = segmentHeightPct(completionRatio);
          const isFuture = i > todayIndex;
          const isFilledOut = combinedRatio >= 1;

          return (
            <View
              key={i}
              style={[styles.daySquare, isFuture && styles.daySquareFuture]}
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
              <View style={styles.dayLetterWrap}>
                <Text
                  style={[
                    styles.daySquareLetter,
                    isFilledOut && styles.daySquareLetterDone,
                    isFuture && styles.daySquareLetterFuture,
                  ]}
                >
                  {day}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  streakContainer: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.streakHousing,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 0.5,
    borderColor: colors.streakBorder,
  },
  streakHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  streakLabel: {
    color: colors.text,
    ...typography.smallBold,
  },
  streakSub: {
    color: colors.streakMuted,
    ...typography.caption,
  },
  weekStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
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
    fontSize: 13,
    fontWeight: "700",
  },
  daySquareLetterDone: {
    color: colors.text,
  },
  daySquareLetterFuture: {
    color: colors.streakMuted,
  },
});
