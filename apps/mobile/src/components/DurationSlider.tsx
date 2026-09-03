import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { hapticDetent, hapticSelect } from "../lib/haptics";
import { Colors, radii, spacing, typography, numeric } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

const THUMB = 26;
const TRACK = 6;

interface Props {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  /** Rendered beside the track. Live during the drag, so keep it short. */
  formatValue: (value: number) => string;
}

/**
 * Minute-resolution slider on reanimated + gesture-handler. No slider
 * dependency is installed and adding one for a single control is the
 * trade the interval stepper already refused.
 *
 * The thumb is positioned from the `value` prop rather than from a shared
 * value driven by the gesture. One source of truth, and there is nothing
 * to animate — the readout must track the finger exactly, and a spring
 * between them would read as lag.
 */
export function DurationSlider({ min, max, value, onChange, formatValue }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [width, setWidth] = useState(0);

  const trackWidth = useSharedValue(0);
  const reported = useSharedValue(value);
  const railed = useSharedValue(false);

  const range = Math.max(max - min, 1);
  const disabled = max <= min;
  const usable = Math.max(width - THUMB, 1);
  const fraction = Math.min(Math.max((value - min) / range, 0), 1);
  const thumbLeft = fraction * usable;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidth(w);
    trackWidth.value = w;
  };

  const apply = (x: number) => {
    "worklet";
    const span = Math.max(trackWidth.value - THUMB, 1);
    const f = Math.min(Math.max((x - THUMB / 2) / span, 0), 1);
    const next = Math.round(min + f * range);

    // A detent at each rail, once per arrival. Per-minute feedback would be
    // a buzz train, which reads as an alert rather than a confirmation.
    const atRail = next <= min || next >= max;
    if (atRail && !railed.value) runOnJS(hapticDetent)();
    railed.value = atRail;

    if (next !== reported.value) {
      reported.value = next;
      runOnJS(onChange)(next);
    }
  };

  // Horizontal intent only. The recovery screen is a ScrollView and a pan
  // that activates on touch-down would eat every scroll that started here.
  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-8, 8])
    .failOffsetY([-14, 14])
    .onStart((e) => {
      reported.value = value;
      runOnJS(hapticSelect)();
      apply(e.x);
    })
    .onUpdate((e) => apply(e.x));

  return (
    <View style={styles.row}>
      <GestureDetector gesture={pan}>
        <View style={styles.hit} onLayout={handleLayout}>
          <View style={styles.track} />
          <View style={[styles.fill, { width: thumbLeft + THUMB / 2 }]} />
          <View style={[styles.thumb, { left: thumbLeft }]} />
        </View>
      </GestureDetector>
      <Text style={styles.readout}>{formatValue(value)}</Text>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    hit: {
      flex: 1,
      height: 40,
      justifyContent: "center",
    },
    track: {
      height: TRACK,
      borderRadius: TRACK / 2,
      backgroundColor: c.border,
    },
    fill: {
      position: "absolute",
      height: TRACK,
      borderRadius: TRACK / 2,
      backgroundColor: c.primary,
    },
    thumb: {
      position: "absolute",
      width: THUMB,
      height: THUMB,
      borderRadius: radii.pill,
      backgroundColor: c.primary,
      borderWidth: 2,
      borderColor: c.surface,
    },
    readout: {
      color: c.text,
      ...typography.bodyBold,
      ...numeric,
      minWidth: 62,
      textAlign: "right",
    },
  });
