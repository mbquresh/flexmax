import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { TodayStats } from "../lib/stats";
import { colors, spacing, radii, typography } from "../theme";

interface StreakStripProps {
  stats: TodayStats;
}

export function StreakStrip({ stats }: StreakStripProps) {
  return (
    <View style={styles.streakContainer}>
      <View style={styles.streakHeader}>
        <Text style={styles.streakLabel}>
          {stats.streak > 0
            ? `🔥 ${stats.streak}-day streak`
            : "Start your streak today"}
        </Text>
        <Text style={styles.streakSub}>{stats.completionRate}% this week</Text>
      </View>
      <View style={styles.weekStrip}>
        {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => {
          const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
          const isToday = i === todayIndex;
          const isDone = stats.weekDayCompletions[i];
          const isFuture = i > todayIndex;

          return (
            <View
              key={i}
              style={[
                styles.daySquare,
                isDone && styles.daySquareDone,
                isToday && !isDone && styles.daySquareToday,
                isFuture && styles.daySquareFuture,
              ]}
            >
              <Text
                style={[
                  styles.daySquareLetter,
                  isDone && styles.daySquareLetterDone,
                  isFuture && styles.daySquareLetterFuture,
                ]}
              >
                {day}
              </Text>
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
    color: colors.streak,
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
    backgroundColor: colors.streakBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  daySquareDone: {
    backgroundColor: colors.streak,
  },
  daySquareToday: {
    backgroundColor: colors.streakBorder,
    borderWidth: 1.5,
    borderColor: colors.streak,
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
