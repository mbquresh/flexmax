import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  NativeSyntheticEvent,
  TextLayoutEventData,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { AdhocTask } from "../types/database";
import { minutesToTime } from "../lib/time";
import { Colors, spacing, radii, iconSizes } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { AdhocSwipeReveal } from "./AdhocSwipeReveal";

interface AdhocTimedCardProps {
  task: AdhocTask;
  onToggle: (task: AdhocTask) => void;
  onDelete: (task: AdhocTask) => void;
  onEdit: (task: AdhocTask) => void;
}

export function AdhocTimedCard({ task, onToggle, onDelete, onEdit }: AdhocTimedCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDone = task.status === "completed";
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [swipeOpen, setSwipeOpen] = useState(false);
  const closeSwipeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setExpanded(false);
    setIsTruncated(false);
  }, [task.name]);

  const handleNameLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (!expanded) {
      setIsTruncated(e.nativeEvent.lines.length > 2);
    }
  };

  const handleBodyPress = () => {
    if (swipeOpen) {
      closeSwipeRef.current?.();
      return;
    }
    onEdit(task);
  };

  const handleNamePress = () => {
    if (swipeOpen) {
      closeSwipeRef.current?.();
      return;
    }
    setExpanded((v) => !v);
  };

  const nameIsTappable = isTruncated || expanded;

  return (
    <AdhocSwipeReveal
      onDelete={() => onDelete(task)}
      onOpenChange={setSwipeOpen}
      closeRef={closeSwipeRef}
      style={{ marginBottom: 10 }}
    >
      <View style={[styles.card, isDone && styles.cardDone]}>
        <View style={styles.accent} />
        <View style={styles.body}>
          <View style={styles.topRow}>
            <View style={styles.nameWrap}>
              <Text
                style={[styles.nameMeasure, isDone && styles.nameDone]}
                onTextLayout={handleNameLayout}
              >
                {task.name}
              </Text>
              {nameIsTappable ? (
                <TouchableOpacity onPress={handleNamePress} activeOpacity={0.7}>
                  <Text
                    style={[styles.name, isDone && styles.nameDone]}
                    numberOfLines={expanded ? undefined : 2}
                  >
                    {task.name}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text
                  style={[styles.name, isDone && styles.nameDone]}
                  numberOfLines={2}
                >
                  {task.name}
                </Text>
              )}
            </View>
            <PressableScale
              onPress={() => onToggle(task)}
              scaleTo={0.9}
              hitSlop={8}
            >
              <View style={[styles.actionCircle, isDone && styles.actionCircleDone]}>
                {isDone ? (
                  <Feather name="check" size={iconSizes.md} color={colors.text} />
                ) : null}
              </View>
            </PressableScale>
          </View>
          <Pressable style={styles.bodyPress} onPress={handleBodyPress}>
            <Text style={styles.meta}>
              {minutesToTime(task.start_minutes!)} – {minutesToTime(task.end_minutes!)}
            </Text>
            <Text style={styles.tag}>One-off</Text>
          </Pressable>
        </View>
      </View>
    </AdhocSwipeReveal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      borderRadius: radii.lg,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      // No shadow. Adhoc cards stay flat to differentiate them from schedule
      // blocks, which are elevated. Do not add shadowRest here.
    },
    cardDone: {
      opacity: 0.55,
    },
    accent: {
      width: 4,
      backgroundColor: c.primary,
      opacity: 0.45,
    },
    body: {
      flex: 1,
      padding: 14,
      gap: spacing.xs,
    },
    bodyPress: {
      gap: spacing.xs,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
    },
    nameWrap: {
      flex: 1,
    },
    nameMeasure: {
      position: "absolute",
      opacity: 0,
      zIndex: -1,
      left: 0,
      right: 0,
      fontSize: 16,
      fontWeight: "600",
    },
    name: {
      color: c.text,
      fontSize: 16,
      fontWeight: "600",
    },
    nameDone: {
      textDecorationLine: "line-through",
      color: c.success,
    },
    meta: {
      color: c.textMuted,
      fontSize: 13,
    },
    tag: {
      alignSelf: "flex-start",
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    actionCircle: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    actionCircleDone: {
      borderColor: c.success,
      backgroundColor: c.success,
    },
  });
