import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  SharedValue,
} from "react-native-reanimated";
import Svg, { Rect, Path } from "react-native-svg";
import { useTheme } from "../providers/ThemeProvider";
import { MARK_W, MARK_H } from "./BrandMark";

const FLOOR = 0.35;
const BEAT = 330;
const STAGGER = 220;

function startPulse(value: SharedValue<number>, index: number) {
  value.value = withDelay(
    index * STAGGER,
    withRepeat(
      withSequence(
        withTiming(1, { duration: BEAT, easing: Easing.out(Easing.quad) }),
        withTiming(FLOOR, { duration: BEAT, easing: Easing.in(Easing.quad) })
      ),
      -1,
      false
    )
  );
}

export function BrandLoader({ size = 64 }: { size?: number }) {
  const { colors } = useTheme();
  const width = (size * MARK_W) / MARK_H;

  const blue = useSharedValue(FLOOR);
  const ink = useSharedValue(FLOOR);
  const coral = useSharedValue(FLOOR);

  useEffect(() => {
    startPulse(blue, 0);
    startPulse(ink, 1);
    startPulse(coral, 2);
  }, [blue, ink, coral]);

  const blueStyle = useAnimatedStyle(() => ({ opacity: blue.value }));
  const inkStyle = useAnimatedStyle(() => ({ opacity: ink.value }));
  const coralStyle = useAnimatedStyle(() => ({ opacity: coral.value }));

  return (
    <View style={[styles.container, { width, height: size }]}>
      <Animated.View style={[styles.layer, blueStyle]}>
        <Svg width={width} height={size} viewBox={`0 0 ${MARK_W} ${MARK_H}`}>
          <Rect x={0} y={0} width={128} height={545} rx={64} fill={colors.menuBarBlue} />
          <Rect x={0} y={0} width={442} height={128} rx={64} fill={colors.menuBarBlue} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, coralStyle]}>
        <Svg width={width} height={size} viewBox={`0 0 ${MARK_W} ${MARK_H}`}>
          <Rect x={0} y={209} width={340} height={128} rx={64} fill={colors.menuBarCoral} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, inkStyle]}>
        <Svg width={width} height={size} viewBox={`0 0 ${MARK_W} ${MARK_H}`}>
          <Path
            d="M127,209 H64 A64,64 0 0,0 64,337 H127 Z"
            fill={colors.menuBarInk}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
});
