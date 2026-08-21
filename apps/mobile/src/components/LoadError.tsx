import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, spacing, radii, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";

interface LoadErrorProps {
  offline: boolean;
  onRetry: () => void;
}

export function LoadError({ offline, onRetry }: LoadErrorProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.content}>
      <Text style={styles.title}>{offline ? "You're offline" : "Couldn't load"}</Text>
      <Text style={styles.body}>
        {offline
          ? "Check your connection and try again."
          : "Something went wrong loading this screen."}
      </Text>
      <PressableScale style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Try again</Text>
      </PressableScale>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    content: {
      alignItems: "center",
      paddingHorizontal: spacing.xxl,
      gap: spacing.md,
    },
    title: {
      color: c.text,
      ...typography.heading,
      textAlign: "center",
    },
    body: {
      color: c.textMuted,
      ...typography.body,
      textAlign: "center",
    },
    button: {
      marginTop: spacing.sm,
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      paddingVertical: 14,
      paddingHorizontal: spacing.xxl,
    },
    buttonText: {
      color: c.onPrimary,
      ...typography.bodyBold,
    },
  });
