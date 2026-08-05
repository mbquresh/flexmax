import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { TodayStats } from "../lib/stats";
import { getLocalDateString } from "../lib/time";
import { DaySquare, daySquareStripStyles } from "./DaySquare";
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
            : "No streak yet"}
        </Text>
        <Text style={styles.streakSub}>{completionRate}% completed this week</Text>
      </View>
      <View style={daySquareStripStyles.weekStrip}>
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
          const isFuture = i > todayIndex;

          return (
            <DaySquare
              key={i}
              letter={day}
              completionRatio={completionRatio}
              missedRatio={missedRatio}
              isToday={isToday}
              isFuture={isFuture}
            />
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
});
