import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { WeekView, addDays, mondayOf, weekDates } from "../lib/stats";
import { formatWeekRange, parseLocalDate } from "../lib/time";
import { hapticSelect, hapticPickUp, hapticReject } from "../lib/haptics";
import {
  DaySquare,
  WEEK_STRIP_LABELS,
  daySquareStripStyles,
} from "./DaySquare";
import { PressableScale } from "./PressableScale";
import { Colors, spacing, typography, numeric, iconSizes } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

export const WEEK_STRIP_GAP = 6;

interface WeekRowProps {
  week: WeekView;
  todayStr: string;
  selectedDate: string;
  liveDate?: string;
  liveCompletionRatio?: number;
  liveMissedRatio?: number;
  applyLive: boolean;
  onSelectDay: (dateStr: string) => void;
}

function WeekRow({
  week,
  todayStr,
  selectedDate,
  liveDate,
  liveCompletionRatio,
  liveMissedRatio,
  applyLive,
  onSelectDay,
}: WeekRowProps) {
  const dates = weekDates(week.mondayStr);
  return (
    <View style={daySquareStripStyles.weekStrip}>
      {WEEK_STRIP_LABELS.map((weekday, i) => {
        const dateStr = dates[i] ?? "";
        const isToday = dateStr === todayStr;
        const isLive = applyLive && dateStr === liveDate;
        const completionRatio =
          isLive && liveCompletionRatio !== undefined
            ? liveCompletionRatio
            : week.completionRatio[i] ?? 0;
        const missedRatio =
          isLive && liveMissedRatio !== undefined
            ? liveMissedRatio
            : week.missedRatio[i] ?? 0;

        return (
          <Pressable
            key={`${week.mondayStr}-${i}`}
            style={daySquareStripStyles.dayHit}
            delayLongPress={350}
            onLongPress={() => {
              if (!dateStr) return;
              if (dateStr > todayStr) {
                hapticReject();
                return;
              }
              hapticPickUp();
              onSelectDay(dateStr);
            }}
          >
            <DaySquare
              weekday={weekday}
              date={dateStr ? parseLocalDate(dateStr).getDate() : undefined}
              completionRatio={completionRatio}
              missedRatio={missedRatio}
              isToday={isToday}
              isFuture={dateStr > todayStr}
              isSelected={dateStr === selectedDate && !isToday}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

interface StreakStripProps {
  weeks: WeekView[];
  selectedMonday: string;
  todayStr: string;
  selectedDate: string;
  streak: number;
  rateOverride?: number;
  liveDate?: string;
  liveCompletionRatio?: number;
  liveMissedRatio?: number;
  onSelectMonday: (mondayStr: string) => void;
  onSelectDay: (dateStr: string) => void;
}

export function StreakStrip({
  weeks,
  selectedMonday,
  todayStr,
  selectedDate,
  streak,
  rateOverride,
  liveDate,
  liveCompletionRatio,
  liveMissedRatio,
  onSelectMonday,
  onSelectDay,
}: StreakStripProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const offsetX = useRef(0);
  const [pageWidth, setPageWidth] = useState(0);

  const currentMonday = mondayOf(todayStr);
  const selected =
    weeks.find((w) => w.mondayStr === selectedMonday) ?? weeks[weeks.length - 1];
  const selectedIndex = Math.max(
    0,
    weeks.findIndex((w) => w.mondayStr === selected?.mondayStr)
  );
  const isCurrentWeek = selected?.mondayStr === currentMonday;
  const canGoBack = selectedIndex > 0;
  const canGoForward = selectedIndex < weeks.length - 1;
  const rate = isCurrentWeek
    ? rateOverride ?? selected?.completionRate ?? 0
    : selected?.completionRate ?? 0;

  const snap = pageWidth + WEEK_STRIP_GAP;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w <= 0 || w === pageWidth) return;
    setPageWidth(w);
  };

  useEffect(() => {
    if (pageWidth <= 0 || !weeks.length) return;
    const i = weeks.findIndex((w) => w.mondayStr === selectedMonday);
    const index = i >= 0 ? i : weeks.length - 1;
    const x = index * (pageWidth + WEEK_STRIP_GAP);
    if (Math.abs(offsetX.current - x) < 2) return;
    scrollRef.current?.scrollTo({ x, animated: offsetX.current > 0 });
    offsetX.current = x;
  }, [pageWidth, selectedMonday, weeks]);

  const commitFromOffset = (x: number) => {
    if (snap <= 0 || !weeks.length) return;
    const index = Math.max(
      0,
      Math.min(weeks.length - 1, Math.round(x / snap))
    );
    const monday = weeks[index]?.mondayStr;
    if (!monday || monday === selectedMonday) return;
    hapticSelect();
    onSelectMonday(monday);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetX.current = e.nativeEvent.contentOffset.x;
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetX.current = e.nativeEvent.contentOffset.x;
    commitFromOffset(e.nativeEvent.contentOffset.x);
  };

  const step = (delta: -1 | 1) => {
    const next = selectedIndex + delta;
    if (next < 0 || next >= weeks.length) {
      hapticReject();
      return;
    }
    hapticSelect();
    onSelectMonday(weeks[next].mondayStr);
  };

  return (
    <View style={styles.streakContainer}>
      <View style={styles.streakHeader}>
        <Text style={styles.streakLabel}>
          {isCurrentWeek
            ? streak > 0
              ? `${streak}-day streak`
              : "Start streak today"
            : selected
              ? formatWeekRange(selected.mondayStr, addDays(selected.mondayStr, 6))
              : ""}
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
      <View onLayout={handleLayout}>
        {pageWidth > 0 ? (
          <ScrollView
            key={`${weeks[0]?.mondayStr ?? ""}-${weeks.length}`}
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={snap}
            snapToAlignment="start"
            disableIntervalMomentum
            directionalLockEnabled
            nestedScrollEnabled
            bounces
            contentOffset={{ x: selectedIndex * snap, y: 0 }}
            onScroll={handleScroll}
            onScrollEndDrag={handleScrollEnd}
            onMomentumScrollEnd={handleScrollEnd}
            scrollEventThrottle={16}
          >
            {weeks.map((week, i) => (
              <View
                key={week.mondayStr}
                style={{
                  width: pageWidth,
                  marginRight: i < weeks.length - 1 ? WEEK_STRIP_GAP : 0,
                }}
              >
                <WeekRow
                  week={week}
                  todayStr={todayStr}
                  selectedDate={selectedDate}
                  liveDate={liveDate}
                  liveCompletionRatio={liveCompletionRatio}
                  liveMissedRatio={liveMissedRatio}
                  applyLive={week.mondayStr === currentMonday}
                  onSelectDay={onSelectDay}
                />
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    streakContainer: {
      marginTop: spacing.lg,
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
