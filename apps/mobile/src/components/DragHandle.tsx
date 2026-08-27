import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Colors } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

const DOT_SIZE = 3.5;
const DOT_GAP = 3.5;

export function DragHandle() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.column}>
      {Array.from({ length: 3 }, (_, i) => (
        <View key={i} style={styles.dot} />
      ))}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    column: {
      alignItems: "center",
      rowGap: DOT_GAP,
    },
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
      backgroundColor: c.textDisabled,
    },
  });
