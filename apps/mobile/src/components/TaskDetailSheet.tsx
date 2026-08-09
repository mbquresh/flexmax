import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated as RNAnimated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { DailyInstance } from "../types/database";
import { Colors, spacing, radii, typography, iconSizes } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";

interface TaskDetailSheetProps {
  instance: DailyInstance | null;
  visible: boolean;
  slideAnim: RNAnimated.Value;
  value: string;
  saving: boolean;
  onChangeText: (text: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function TaskDetailSheet({
  instance,
  visible,
  slideAnim,
  value,
  saving,
  onChangeText,
  onSave,
  onClose,
}: TaskDetailSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Pressable style={styles.overlayDismiss} onPress={onClose} />
        <RNAnimated.View
          style={[styles.taskSheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <View style={styles.taskSheetHeader}>
            <View style={styles.taskSheetHeaderText}>
              <Text style={styles.sheetTitle}>{instance?.block?.name ?? "Block"}</Text>
              <Text style={styles.taskSheetSubtitle}>What will you actually do?</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Feather name="x" size={iconSizes.md} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.taskDetailInput}
            value={value}
            onChangeText={onChangeText}
            placeholder="e.g. Chest day + 20 min run"
            placeholderTextColor={colors.textPlaceholder}
            autoFocus
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <PressableScale
            style={styles.taskSaveBtn}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.taskSaveBtnText}>Save</Text>
            )}
          </PressableScale>
        </RNAnimated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    overlayDismiss: {
      flex: 1,
    },
    taskSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.pill,
      borderTopRightRadius: radii.pill,
      paddingHorizontal: spacing.xxl,
      paddingBottom: Platform.OS === "ios" ? 36 : 24,
      paddingTop: spacing.xxl,
    },
    taskSheetHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    taskSheetHeaderText: { flex: 1 },
    sheetTitle: {
      color: c.text,
      fontSize: 18,
      fontWeight: "600",
    },
    taskSheetSubtitle: { color: c.textMuted, fontSize: 14, marginTop: spacing.xs },
    taskDetailInput: {
      backgroundColor: c.surfaceNested,
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      color: c.text,
      fontSize: 15,
      minHeight: 88,
      maxHeight: 88,
      marginBottom: spacing.xl,
    },
    taskSaveBtn: {
      marginTop: spacing.lg,
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      paddingVertical: 14,
      alignItems: "center",
    },
    taskSaveBtnText: { color: c.onPrimary, ...typography.bodyBold },
  });
