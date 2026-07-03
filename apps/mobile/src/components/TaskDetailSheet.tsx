import React from "react";
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
import { DailyInstance } from "../types/database";
import { colors, spacing, radii, typography } from "../theme";

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
              <Text style={styles.taskSheetClose}>✕</Text>
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

          <TouchableOpacity
            style={[styles.taskSaveBtn, saving && styles.btnDisabled]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.taskSaveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </RNAnimated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  overlayDismiss: {
    flex: 1,
  },
  taskSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.pill,
    borderTopRightRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingTop: spacing.lg,
  },
  taskSheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  taskSheetHeaderText: { flex: 1 },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  taskSheetSubtitle: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs },
  taskSheetClose: { color: colors.textMuted, fontSize: 20, lineHeight: 22 },
  taskDetailInput: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
    minHeight: 88,
    maxHeight: 88,
  },
  taskSaveBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  taskSaveBtnText: { color: colors.onPrimary, ...typography.bodyBold },
  btnDisabled: { opacity: 0.5 },
});
