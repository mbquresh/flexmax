import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  Animated as RNAnimated,
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
  const slideAnim = useRef(new RNAnimated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(400);
      RNAnimated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleClose = () => {
    RNAnimated.timing(slideAnim, {
      toValue: 400,
      duration: 180,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const firstDangerIndex = items.findIndex((item) => item.danger);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
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
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
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
    backgroundColor: colors.textDisabled,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  menuRow: {
    paddingVertical: 14,
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
