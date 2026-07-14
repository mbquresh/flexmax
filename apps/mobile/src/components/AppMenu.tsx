import React, { useEffect, useRef } from "react";
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
import { colors, spacing, radii, typography } from "../theme";

export interface AppMenuItem {
  label: string;
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

export function MenuButton({ onPress }: MenuButtonProps) {
  return (
    <TouchableOpacity
      style={styles.menuButton}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
    >
      <View style={[styles.menuBar, { backgroundColor: colors.menuBarBlue }]} />
      <View style={[styles.menuBar, { backgroundColor: colors.menuBarInk }]} />
      <View style={[styles.menuBar, { backgroundColor: colors.menuBarCoral }]} />
    </TouchableOpacity>
  );
}

export function AppMenu({ visible, onClose, items }: AppMenuProps) {
  const slideAnim = useRef(new RNAnimated.Value(SHEET_OFFSET)).current;
  const scrimAnim = useRef(new RNAnimated.Value(0)).current;

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
          toValue: 0.4,
          duration: OPEN_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, scrimAnim]);

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
                    onPress={item.onPress}
                  >
                    <Text
                      style={[styles.menuRowText, item.danger && styles.menuRowTextDanger]}
                    >
                      {item.label}
                    </Text>
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

const styles = StyleSheet.create({
  menuButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: colors.overlayScrim,
  },
  overlayPressable: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.pill,
    borderTopRightRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingTop: 10,
  },
  sheetHandleWrap: {
    alignSelf: "center",
    paddingBottom: spacing.lg,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  menuRow: {
    paddingVertical: 16,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
  },
  menuRowPressed: {
    backgroundColor: colors.surfaceNested,
  },
  menuRowText: {
    color: colors.text,
    ...typography.body,
    textAlign: "left",
  },
  menuRowTextDanger: {
    color: colors.danger,
  },
});
