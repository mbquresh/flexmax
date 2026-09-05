import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, numeric, radii, spacing, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { WeekBar } from "../lib/stats";
import { segmentHeightPct } from "./DaySquare";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthDay(mondayStr: string): string {
  const [, month, day] = mondayStr.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

interface Props {
  weeks: WeekBar[];
  currentMonday: string;
}

export function WeekSeriesChart({ weeks, currentMonday }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const first = weeks[0];
  const last = weeks[weeks.length - 1];

  return (
    <View>
      <View style={styles.plot}>
        {weeks.map((week) => {
          const combinedPct = segmentHeightPct(
            week.completedRatio + week.missedRatio
          );
          const completedPct = segmentHeightPct(week.completedRatio);
          const isCurrent = week.mondayStr === currentMonday;
          return (
            <View key={week.mondayStr} style={styles.col}>
              <View
                style={[
                  styles.track,
                  isCurrent && styles.trackCurrent,
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
              </View>
            </View>
          );
        })}
      </View>
      {first && last ? (
        <View style={styles.axis}>
          <Text style={styles.axisLabel}>{monthDay(first.mondayStr)}</Text>
          <Text style={styles.axisLabel}>
            {last.mondayStr === currentMonday ? "Now" : monthDay(last.mondayStr)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    plot: {
      height: 148,
      flexDirection: "row",
      alignItems: "stretch",
      gap: 5,
    },
    col: {
      flex: 1,
    },
    track: {
      flex: 1,
      backgroundColor: c.streakSquare,
      borderRadius: radii.xs,
      overflow: "hidden",
    },
    trackCurrent: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    fill: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
    },
    axis: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.sm,
    },
    axisLabel: {
      color: c.textFaint,
      ...typography.caption,
      ...numeric,
    },
  });
