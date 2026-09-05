import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  Animated as RNAnimated,
  Easing,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Colors, spacing, radii, typography, iconSizes } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { hapticSelect } from "../lib/haptics";
import { PressableScale } from "./PressableScale";

export interface AppMenuItem {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  danger?: boolean;
  onPress: () => void;
}

interface AppMenuProps {
  visible: boolean;
  onClose: () => void;
  items: AppMenuItem[];
}

interface MenuButtonProps {
  onPress: () => void;
}

const SHEET_OFFSET = 400;
const OPEN_DURATION = 220;
const CLOSE_DURATION = 180;
const SCRIM_OPACITY_LIGHT = 0.4;
const SCRIM_OPACITY_DARK = 0.6;

export function MenuButton({ onPress }: MenuButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <PressableScale
      style={styles.menuButton}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
    >
      <View style={[styles.menuBar, { backgroundColor: colors.menuBarBlue }]} />
      <View style={[styles.menuBar, { backgroundColor: colors.menuBarInk }]} />
      <View style={[styles.menuBar, { backgroundColor: colors.menuBarCoral }]} />
    </PressableScale>
  );
}

export function AppMenu({ visible, onClose, items }: AppMenuProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const slideAnim = useRef(new RNAnimated.Value(SHEET_OFFSET)).current;
  const scrimAnim = useRef(new RNAnimated.Value(0)).current;
  const scrimOpacity = scheme === "dark" ? SCRIM_OPACITY_DARK : SCRIM_OPACITY_LIGHT;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(SHEET_OFFSET);
      scrimAnim.setValue(0);
      RNAnimated.parallel([
        RNAnimated.timing(slideAnim, {
          toValue: 0,
          duration: OPEN_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        RNAnimated.timing(scrimAnim, {
          toValue: scrimOpacity,
          duration: OPEN_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, scrimAnim, scrimOpacity]);

  const handleClose = () => {
    RNAnimated.parallel([
      RNAnimated.timing(slideAnim, {
        toValue: SHEET_OFFSET,
        duration: CLOSE_DURATION,
        useNativeDriver: true,
      }),
      RNAnimated.timing(scrimAnim, {
        toValue: 0,
        duration: CLOSE_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const firstDangerIndex = items.findIndex((item) => item.danger);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.root}>
        <RNAnimated.View
          style={[styles.scrim, { opacity: scrimAnim }]}
          pointerEvents="none"
        />

        <Pressable style={styles.overlayPressable} onPress={handleClose}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <RNAnimated.View
              style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
            >
              <Pressable style={styles.sheetHandleWrap} onPress={handleClose} hitSlop={8}>
                <View style={styles.sheetHandle} />
              </Pressable>

              {items.map((item, index) => (
                <React.Fragment key={item.label}>
                  {index === firstDangerIndex && firstDangerIndex > 0 ? (
                    <View style={styles.divider} />
                  ) : null}
                  <Pressable
                    style={({ pressed }) => [
                      styles.menuRow,
                      pressed && styles.menuRowPressed,
                    ]}
                    onPress={() => {
                      hapticSelect();
                      item.onPress();
                    }}
                  >
                    <Feather
                      name={item.icon}
                      size={iconSizes.md}
                      color={item.danger ? colors.danger : colors.textMuted}
                    />
                    <Text
                      style={[styles.menuRowText, item.danger && styles.menuRowTextDanger]}
                    >
                      {item.label}
                    </Text>
                    {!item.danger ? (
                      <Feather
                        name="chevron-right"
                        size={iconSizes.sm}
                        color={colors.textFaint}
                      />
                    ) : null}
                  </Pressable>
                </React.Fragment>
              ))}
            </RNAnimated.View>
          </Pressable>
        </Pressable>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    menuButton: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      ...c.shadowRest,
    },
    menuBar: {
      width: 18,
      height: 2,
      borderRadius: 1,
      marginVertical: 1.5,
    },
    root: {
      flex: 1,
      justifyContent: "flex-end",
    },
    scrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlayScrim,
    },
    overlayPressable: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.pill,
      borderTopRightRadius: radii.pill,
      borderTopWidth: 0.5,
      borderLeftWidth: 0.5,
      borderRightWidth: 0.5,
      borderColor: c.border,
      paddingHorizontal: spacing.xl,
      paddingBottom: Platform.OS === "ios" ? 36 : 24,
      paddingTop: 10,
      ...c.shadowRest,
    },
    sheetHandleWrap: {
      alignSelf: "center",
      paddingBottom: spacing.lg,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
    },
    divider: {
      height: 0.5,
      backgroundColor: c.border,
      marginBottom: spacing.xs,
    },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: 16,
      paddingHorizontal: spacing.md,
      borderRadius: radii.sm,
    },
    menuRowPressed: {
      backgroundColor: c.surfaceNested,
    },
    menuRowText: {
      flex: 1,
      color: c.text,
      ...typography.body,
      textAlign: "left",
    },
    menuRowTextDanger: {
      color: c.danger,
    },
  });
