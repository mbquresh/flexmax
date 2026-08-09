import React, { useEffect } from "react";
import { Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const PRESS_SCALE = 0.97;
const PRESS_IN_MS = 100;
const PRESS_OUT_MS = 150;
const DISABLED_OPACITY = 0.55;
const DISABLED_MS = 160;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  children: React.ReactNode;
};

export function PressableScale({
  style,
  disabled = false,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(disabled ? DISABLED_OPACITY : 1, { duration: DISABLED_MS });
    if (disabled) {
      scale.value = 1;
    }
  }, [disabled, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        if (!disabled) {
          scale.value = withTiming(PRESS_SCALE, { duration: PRESS_IN_MS });
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!disabled) {
          scale.value = withTiming(1, { duration: PRESS_OUT_MS });
        }
        onPressOut?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
