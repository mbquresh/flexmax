import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { WeekView, addDays, mondayOf, weekDates } from "../lib/stats";
import { formatWeekRange } from "../lib/time";
import { hapticSelect, hapticPickUp, hapticReject } from "../lib/haptics";
import { DaySquare, daySquareStripStyles } from "./DaySquare";
import { PressableScale } from "./PressableScale";
import { Colors, spacing, radii, typography, numeric, iconSizes } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

const SQUARE_GAP = 6;
// Travel per week step. Short enough to feel like a scrub, long enough that
// a diagonal flick during a vertical scroll does not jump two months.
const STEP_PX = 44;

interface StreakStripProps {
  /** The week on screen, already resolved to ratios by the caller. */
  week: WeekView;
  todayStr: string;
  /** The day currently open on Today. Ringed. */
  selectedDate: string;
  streak: number;
  /** Live rate for the current week, which the fetched WeekView lags. */
  rateOverride?: number;
  /**
   * The square whose ratios come from the loaded day rather than from the
   * fetched week. Always the day on screen — a backfill has to move its own
   * square immediately, which is the entire payoff for doing it.
   */
  liveDate?: string;
  liveCompletionRatio?: number;
  liveMissedRatio?: number;
  canGoBack: boolean;
  onStepWeek: (delta: -1 | 1) => void;
  onSelectDay: (dateStr: string) => void;
}

export function StreakStrip({
  week,
  todayStr,
  selectedDate,
  streak,
  rateOverride,
  liveDate,
  liveCompletionRatio,
  liveMissedRatio,
  canGoBack,
  onStepWeek,
  onSelectDay,
}: StreakStripProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [stripWidth, setStripWidth] = useState(0);

  const dates = useMemo(() => weekDates(week.mondayStr), [week.mondayStr]);
  const isCurrentWeek = week.mondayStr === mondayOf(todayStr);
  const canGoForward = !isCurrentWeek;
  const rate = isCurrentWeek ? rateOverride ?? week.completionRate : week.completionRate;

  const widthShared = useSharedValue(0);
  const stepped = useSharedValue(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setStripWidth(w);
    widthShared.value = w;
  };

  const step = (delta: -1 | 1) => {
    if (delta === -1 && !canGoBack) {
      hapticReject();
      return;
    }
    if (delta === 1 && !canGoForward) {
      hapticReject();
      return;
    }
    hapticSelect();
    onStepWeek(delta);
  };

  const selectAt = (x: number) => {
    if (stripWidth <= 0) return;
    const cell = (stripWidth - SQUARE_GAP * 6) / 7;
    const index = Math.min(
      6,
      Math.max(0, Math.floor(x / (cell + SQUARE_GAP)))
    );
    const dateStr = dates[index];
    if (!dateStr) return;
    // A day that has not happened has nothing to account for.
    if (dateStr > todayStr) {
      hapticReject();
      return;
    }
    hapticPickUp();
    onSelectDay(dateStr);
  };

  // Dragging right reveals earlier weeks, matching every paged surface on
  // the platform. failOffsetY keeps the page scrollable from the strip.
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onStart(() => {
      stepped.value = 0;
    })
    .onUpdate((e) => {
      const steps = Math.trunc(e.translationX / STEP_PX);
      if (steps === stepped.value) return;
      const delta = steps > stepped.value ? -1 : 1;
      stepped.value = steps;
      runOnJS(step)(delta);
    });

  // Long press rather than tap: the strip is a status display first, and a
  // tap target that navigates would fire on every mis-swipe.
  const longPress = Gesture.LongPress()
    .minDuration(350)
    .maxDistance(14)
    .onStart((e) => {
      runOnJS(selectAt)(e.x);
    });

  return (
    <View style={styles.streakContainer}>
      <View style={styles.streakHeader}>
        <Text style={styles.streakLabel}>
          {isCurrentWeek
            ? streak > 0
              ? `${streak}-day streak`
              : "Start streak today"
            : formatWeekRange(week.mondayStr, addDays(week.mondayStr, 6))}
        </Text>
        <View style={styles.streakHeaderRight}>
          <Text style={styles.streakSub}>
            {rate}%{isCurrentWeek ? " this week" : ""}
          </Text>
          <PressableScale
            onPress={() => step(-1)}
            disabled={!canGoBack}
            hitSlop={8}
          >
            <Feather
              name="chevron-left"
              size={iconSizes.lg}
              color={canGoBack ? colors.textMuted : colors.textFaint}
            />
          </PressableScale>
          <PressableScale
            onPress={() => step(1)}
            disabled={!canGoForward}
            hitSlop={8}
          >
            <Feather
              name="chevron-right"
              size={iconSizes.lg}
              color={canGoForward ? colors.textMuted : colors.textFaint}
            />
          </PressableScale>
        </View>
      </View>
      <GestureDetector gesture={Gesture.Race(pan, longPress)}>
        <View style={daySquareStripStyles.weekStrip} onLayout={handleLayout}>
          {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => {
            const dateStr = dates[i] ?? "";
            const isToday = dateStr === todayStr;
            const isLive = dateStr === liveDate;
            const completionRatio =
              isLive && liveCompletionRatio !== undefined
                ? liveCompletionRatio
                : week.completionRatio[i] ?? 0;
            const missedRatio =
              isLive && liveMissedRatio !== undefined
                ? liveMissedRatio
                : week.missedRatio[i] ?? 0;

            return (
              <DaySquare
                key={`${week.mondayStr}-${i}`}
                letter={day}
                completionRatio={completionRatio}
                missedRatio={missedRatio}
                isToday={isToday}
                isFuture={dateStr > todayStr}
                isSelected={dateStr === selectedDate && !isToday}
              />
            );
          })}
        </View>
      </GestureDetector>
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
    streakHeaderRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
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
