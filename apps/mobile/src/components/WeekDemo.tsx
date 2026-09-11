import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Animated } from "react-native";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { Colors, spacing, radii, typography } from "../theme";
import { hapticSelect } from "../lib/haptics";
// Cell counts live in weekDemoData.ts — founder's measured coupling pair.
import {
  DEMO_BLOCKS,
  DEMO_DAYS,
  DemoFilter,
  dayVisible,
  demoCounts,
} from "../lib/weekDemoData";

const FILTERS: { key: DemoFilter; label: string }[] = [
  { key: "all", label: "All 26 days" },
  { key: "landed", label: "Days the morning landed" },
  { key: "failed", label: "Days it didn't" },
];

export function WeekDemo({ onFiltered }: { onFiltered: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [filter, setFilter] = useState<DemoFilter>("all");
  const dim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(dim, {
      toValue: filter === "all" ? 1 : 0.12,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [filter, dim]);

  const handleFilter = (next: DemoFilter) => {
    hapticSelect();
    setFilter(next);
    if (next !== "all") onFiltered();
  };

  const counts = demoCounts(filter);

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
                  { opacity: dayVisible(day, filter) ? 1 : dim },
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

      <Text style={styles.count}>
        {counts.missed} of {counts.n} missed
      </Text>

      <View style={styles.seg}>
        {FILTERS.map((f) => (
          <PressableScale
            key={f.key}
            style={[styles.segBtn, filter === f.key && styles.segBtnOn]}
            onPress={() => handleFilter(f.key)}
          >
            <Text
              style={[styles.segBtnText, filter === f.key && styles.segBtnTextOn]}
            >
              {f.label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const CELL = 8;
const GAP = 1;
const ROW = 16;
const LABEL_W = 118;

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
    seg: {
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    segBtn: {
      backgroundColor: c.surface,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      alignItems: "center",
      borderWidth: 0.5,
      borderColor: c.border,
    },
    segBtnOn: {
      borderColor: c.text,
    },
    segBtnText: {
      color: c.textMuted,
      ...typography.bodyBold,
      textAlign: "center",
    },
    segBtnTextOn: {
      color: c.text,
    },
  });
