import React, { useEffect } from "react";
import { Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const PRESS_SCALE = 0.97;
const PRESS_IN_MS = 100;
const PRESS_OUT_MS = 150;
const HIGHLIGHT_IN_MS = 110;
const HIGHLIGHT_OUT_MS = 180;
const DISABLED_OPACITY = 0.55;
const DISABLED_MS = 160;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  variant?: "scale" | "highlight";
  scaleTo?: number;
  baseColor?: string;
  highlightColor?: string;
  children: React.ReactNode;
};

export function PressableScale({
  style,
  disabled = false,
  variant = "scale",
  scaleTo = PRESS_SCALE,
  baseColor,
  highlightColor,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const highlight = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(disabled ? DISABLED_OPACITY : 1, { duration: DISABLED_MS });
    if (disabled) {
      scale.value = 1;
      highlight.value = 0;
    }
  }, [disabled, opacity, scale, highlight]);

  const animatedStyle = useAnimatedStyle(() => {
    if (variant === "highlight" && baseColor && highlightColor) {
      return {
        backgroundColor: interpolateColor(
          highlight.value,
          [0, 1],
          [baseColor, highlightColor]
        ),
        opacity: opacity.value,
      };
    }

    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        if (!disabled) {
          if (variant === "highlight") {
            highlight.value = withTiming(1, { duration: HIGHLIGHT_IN_MS });
          } else {
            scale.value = withTiming(scaleTo, { duration: PRESS_IN_MS });
          }
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!disabled) {
          if (variant === "highlight") {
            highlight.value = withTiming(0, { duration: HIGHLIGHT_OUT_MS });
          } else {
            scale.value = withTiming(1, { duration: PRESS_OUT_MS });
          }
        }
        onPressOut?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
