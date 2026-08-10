import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { TodayStats } from "../lib/stats";
import { getLocalDateString } from "../lib/time";
import { DaySquare, daySquareStripStyles } from "./DaySquare";
import { Colors, spacing, radii, typography, numeric } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

interface StreakStripProps {
  stats: TodayStats;
  todayCompletionRatio?: number;
  todayMissedRatio?: number;
  liveCompletionRate?: number;
  liveStreak?: number;
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
  liveStreak,
}: StreakStripProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const todayIndex = getTodayWeekIndex();
  const completionRate = liveCompletionRate ?? stats.completionRate;
  const streak = liveStreak ?? stats.streak;

  return (
    <View style={styles.streakContainer}>
      <View style={styles.streakHeader}>
        <Text style={styles.streakLabel}>
          {streak > 0
            ? `${streak}-day streak`
            : "Start streak today"}
        </Text>
        <Text style={styles.streakSub}>{completionRate}% this week</Text>
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

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    streakContainer: {
      marginHorizontal: spacing.xl,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
      backgroundColor: c.streakHousing,
      borderRadius: radii.xl,
      padding: 14,
      borderWidth: 0,
      borderColor: c.streakBorder,
      ...c.shadowRest,
    },
    streakHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    streakLabel: {
      color: c.text,
      ...typography.smallBold,
      ...numeric,
    },
    streakSub: {
      color: c.streakMuted,
      ...typography.caption,
      ...numeric,
    },
  });
