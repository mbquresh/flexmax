import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Colors } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

const DOT_SIZE = 2;
const DOT_GAP = 3;

export function DragHandle() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.grid}>
      {Array.from({ length: 6 }, (_, i) => (
        <View key={i} style={styles.dot} />
      ))}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    grid: {
      width: DOT_SIZE * 2 + DOT_GAP,
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: DOT_GAP,
      rowGap: DOT_GAP,
    },
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: 1,
      backgroundColor: c.textDisabled,
    },
  });
