import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Animated } from "react-native";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { Colors, spacing, radii, typography } from "../theme";
import { hapticSelect } from "../lib/haptics";

type DemoDay = { o: number[] };

export const DEMO_BLOCKS = [
  "Fajr",
  "Morning deep work",
  "Breakfast",
  "Admin",
  "Lunch",
  "Afternoon deep work",
  "Gym",
  "Wind down",
];

// The condition is COMPLETION of an earlier block, because that is the only
// cross-block relationship get_behavior_evidence actually computes: an
// aggressor block winning and a later block failing. Overrun is not
// available — actual_end_minutes is captured but read by nothing, and the
// evidence pack explicitly forbids claiming a block "ran until" a time.
const MORNING_INDEX = 1;

const landed = (d: DemoDay) => d.o[MORNING_INDEX] === 1;

// Hand-authored. Verified against row 7 (Gym): 10 days where morning deep
// work landed carry 9 gym failures (90%), the other 20 carry 3 (15%), 12 of
// 30 overall (40%). An exception on each side is deliberate — a perfect
// 100/0 split reads as fabricated. Do not regenerate: the percentages quoted
// in the reveal are computed from these exact cells.
const DEMO_DAYS: DemoDay[] = [
  { o: [1, 0, 1, 0, 1, 0, 1, 0] },
  { o: [1, 0, 1, 1, 1, 1, 0, 0] },
  { o: [1, 0, 1, 1, 1, 1, 1, 0] },
  { o: [1, 1, 1, 1, 1, 0, 0, 0] },
  { o: [1, 1, 0, 1, 1, 1, 0, 0] },
  { o: [1, 1, 1, 0, 1, 1, 1, 1] },
  { o: [1, 0, 1, 0, 1, 0, 1, 1] },
  { o: [0, 1, 1, 1, 1, 1, 0, 0] },
  { o: [1, 0, 0, 0, 1, 1, 1, 0] },
  { o: [1, 1, 1, 1, 1, 0, 0, 1] },
  { o: [1, 1, 1, 1, 1, 0, 0, 0] },
  { o: [1, 1, 0, 0, 1, 0, 0, 1] },
  { o: [1, 0, 0, 1, 0, 0, 1, 1] },
  { o: [1, 0, 1, 1, 1, 0, 1, 0] },
  { o: [1, 0, 1, 1, 1, 0, 1, 1] },
  { o: [1, 0, 1, 0, 1, 0, 0, 0] },
  { o: [1, 0, 1, 1, 1, 1, 1, 1] },
  { o: [1, 0, 1, 1, 1, 0, 1, 1] },
  { o: [1, 1, 0, 1, 0, 0, 0, 1] },
  { o: [1, 0, 1, 0, 1, 0, 1, 1] },
  { o: [1, 0, 1, 0, 1, 1, 1, 1] },
  { o: [1, 0, 1, 1, 0, 0, 1, 0] },
  { o: [1, 1, 1, 1, 0, 0, 0, 1] },
  { o: [1, 0, 1, 0, 1, 1, 1, 1] },
  { o: [1, 0, 0, 1, 1, 1, 1, 0] },
  { o: [1, 0, 1, 1, 1, 1, 1, 0] },
  { o: [1, 0, 1, 1, 1, 0, 0, 0] },
  { o: [1, 1, 0, 1, 1, 1, 0, 0] },
  { o: [1, 0, 1, 1, 1, 0, 1, 1] },
  { o: [0, 0, 1, 1, 1, 1, 1, 1] },
];

export function WeekDemo({ onFiltered }: { onFiltered: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [filtered, setFiltered] = useState(false);
  const dim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(dim, {
      toValue: filtered ? 0.12 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [filtered, dim]);

  const handleFilter = () => {
    hapticSelect();
    const next = !filtered;
    setFiltered(next);
    if (next) onFiltered();
  };

  return (
    <View>
      <View style={styles.heatmap}>
        <View style={styles.labelCol}>
          {DEMO_BLOCKS.map((name) => (
            <Text key={name} style={styles.rowLabel} numberOfLines={1}>
              {name}
            </Text>
          ))}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.gridScroll}
        >
          <View style={styles.daysRow}>
            {DEMO_DAYS.map((day, di) => (
              <Animated.View
                key={di}
                style={[
                  styles.dayCol,
                  { opacity: landed(day) ? 1 : dim },
                ]}
              >
                {day.o.map((v, bi) => (
                  <View
                    key={bi}
                    style={[styles.cell, v ? styles.cellDone : styles.cellMissed]}
                  />
                ))}
              </Animated.View>
            ))}
          </View>
        </ScrollView>
      </View>

      {filtered ? <Text style={styles.count}>10 of 30 days.</Text> : null}

      <PressableScale style={styles.filterBtn} onPress={handleFilter}>
        <Text style={styles.filterBtnText}>
          {filtered
            ? "Show all 30 days"
            : "Show only days morning deep work landed"}
        </Text>
      </PressableScale>
    </View>
  );
}

const CELL = 7;
const GAP = 1;
const ROW = 16;
const LABEL_W = 92;

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    heatmap: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    labelCol: {
      width: LABEL_W,
      marginRight: spacing.sm,
    },
    rowLabel: {
      width: LABEL_W,
      height: ROW,
      marginBottom: GAP,
      textAlign: "right",
      color: c.textMuted,
      fontSize: 10,
      lineHeight: ROW,
      fontWeight: "500",
    },
    gridScroll: {
      flex: 1,
    },
    daysRow: {
      flexDirection: "row",
    },
    dayCol: {
      width: CELL,
      marginRight: GAP,
    },
    cell: {
      width: CELL,
      height: ROW,
      marginBottom: GAP,
    },
    cellDone: {
      backgroundColor: c.primary,
    },
    cellMissed: {
      backgroundColor: c.border,
    },
    count: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: spacing.md,
    },
    filterBtn: {
      marginTop: spacing.lg,
      backgroundColor: c.surface,
      borderRadius: radii.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      alignItems: "center",
      borderWidth: 0.5,
      borderColor: c.border,
    },
    filterBtnText: {
      color: c.text,
      ...typography.bodyBold,
      textAlign: "center",
    },
  });
