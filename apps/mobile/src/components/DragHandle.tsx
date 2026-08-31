import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Colors } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

const DOT_SIZE = 3.5;
const DOT_GAP = 3.5;

interface DragHandleProps {
  color?: string;
  size?: number;
}

export function DragHandle({ color, size }: DragHandleProps = {}) {
  const { colors } = useTheme();
  const styles = useMemo(
    () => makeStyles(colors, color, size),
    [colors, color, size]
  );

  return (
    <View style={styles.column}>
      {Array.from({ length: 3 }, (_, i) => (
        <View key={i} style={styles.dot} />
      ))}
    </View>
  );
}

const makeStyles = (c: Colors, color?: string, size?: number) => {
  const dotSize = size ?? DOT_SIZE;
  return StyleSheet.create({
    column: {
      alignItems: "center",
      rowGap: DOT_GAP,
    },
    dot: {
      width: dotSize,
      height: dotSize,
      borderRadius: dotSize / 2,
      backgroundColor: color ?? c.textDisabled,
    },
  });
};
