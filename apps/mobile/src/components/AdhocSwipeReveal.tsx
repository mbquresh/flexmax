import React, { useMemo } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolate,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { hapticCommit, hapticDetent } from "../lib/haptics";
import { Colors, radii, iconSizes } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

const REVEAL_WIDTH = 80;
const ACTION_BUTTON_WIDTH = 80;

interface AdhocSwipeRevealProps {
  onDelete: () => void;
  onOpenChange?: (open: boolean) => void;
  closeRef?: React.MutableRefObject<(() => void) | null>;
  children: React.ReactNode;
  style?: object;
  borderRadius?: number;
}

export function AdhocSwipeReveal({
  onDelete,
  onOpenChange,
  closeRef,
  children,
  style,
  borderRadius = radii.lg,
}: AdhocSwipeRevealProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const translateX = useSharedValue(0);
  const isOpen = useSharedValue(0);

  const closeSwipe = () => {
    isOpen.value = 0;
    translateX.value = withSpring(0, {
      damping: 20,
      stiffness: 220,
      overshootClamping: true,
    });
    onOpenChange?.(false);
  };

  if (closeRef) {
    closeRef.current = closeSwipe;
  }

  const handleDelete = () => {
    closeSwipe();
    hapticCommit();
    onDelete();
  };

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-8, 8])
    .maxPointers(1)
    .onUpdate((e) => {
      const base = isOpen.value ? -REVEAL_WIDTH : 0;
      translateX.value = Math.max(-REVEAL_WIDTH, Math.min(0, base + e.translationX));
    })
    .onEnd(() => {
      const shouldOpen = translateX.value < -REVEAL_WIDTH / 2;
      isOpen.value = shouldOpen ? 1 : 0;
      translateX.value = withSpring(shouldOpen ? -REVEAL_WIDTH : 0, {
        damping: 20,
        stiffness: 220,
        overshootClamping: true,
      });
      if (shouldOpen) {
        runOnJS(hapticDetent)();
      }
      if (onOpenChange) {
        runOnJS(onOpenChange)(shouldOpen);
      }
    });

  const progress = useDerivedValue(() =>
    Math.min(Math.abs(translateX.value) / REVEAL_WIDTH, 1)
  );

  const deleteBtnStyle = useAnimatedStyle(() => ({
    width: progress.value * ACTION_BUTTON_WIDTH,
    overflow: "hidden",
  }));

  const deleteActionContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.3, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      { scale: interpolate(progress.value, [0.3, 1], [0.6, 1], Extrapolate.CLAMP) },
    ],
  }));

  const slideAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const containerStyle = useMemo(
    () => [styles.container, { borderRadius }, style],
    [borderRadius, style, styles.container]
  );

  const deleteBtnRadius = useMemo(
    () => ({
      borderTopRightRadius: borderRadius,
      borderBottomRightRadius: borderRadius,
    }),
    [borderRadius]
  );

  return (
    <View style={containerStyle}>
      <View style={styles.actionsBehind}>
        <Animated.View
          style={[styles.actionBtn, styles.deleteBtn, deleteBtnRadius, deleteBtnStyle]}
        >
          <TouchableOpacity
            style={styles.actionBtnTouch}
            onPress={handleDelete}
            activeOpacity={0.85}
          >
            <Animated.View style={deleteActionContentStyle}>
              <Feather name="trash-2" size={iconSizes.md} color={colors.onPrimary} />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <GestureDetector gesture={swipeGesture}>
        <Animated.View style={slideAnimatedStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      overflow: "hidden",
    },
    actionsBehind: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "stretch",
    },
    actionBtn: {
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    deleteBtn: {
      backgroundColor: c.danger,
    },
    actionBtnTouch: {
      flex: 1,
      width: ACTION_BUTTON_WIDTH,
      justifyContent: "center",
      alignItems: "center",
    },
  });
