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
import { AdhocTask } from "../types/database";
import { Colors, spacing, radii, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { TimePicker } from "./TimePicker";
import { PressableScale } from "./PressableScale";

interface AdhocEditSheetProps {
  task: AdhocTask | null;
  visible: boolean;
  slideAnim: RNAnimated.Value;
  scrimAnim: RNAnimated.Value;
  name: string;
  startMinutes: number;
  endMinutes: number;
  saving: boolean;
  onChangeName: (text: string) => void;
  onChangeStart: (minutes: number) => void;
  onChangeEnd: (minutes: number) => void;
  onSave: () => void;
  onClose: () => void;
}

export function AdhocEditSheet({
  task,
  visible,
  slideAnim,
  scrimAnim,
  name,
  startMinutes,
  endMinutes,
  saving,
  onChangeName,
  onChangeStart,
  onChangeEnd,
  onSave,
  onClose,
}: AdhocEditSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isTimed = task?.start_minutes != null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <RNAnimated.View
          style={[styles.scrim, { opacity: scrimAnim }]}
          pointerEvents="none"
        />
        <KeyboardAvoidingView
          style={styles.overlayPressable}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={styles.dismiss} onPress={onClose} />
          <Pressable onPress={(e) => e.stopPropagation()}>
            <RNAnimated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
              <View style={styles.handle} />
              <Text style={styles.title}>Edit task</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={onChangeName}
                placeholder="Task name"
                placeholderTextColor={colors.textPlaceholder}
                autoFocus
              />
              {isTimed ? (
                <View style={styles.timeFields}>
                  <TimePicker label="Start" valueMinutes={startMinutes} onChange={onChangeStart} />
                  <TimePicker label="End" valueMinutes={endMinutes} onChange={onChangeEnd} />
                </View>
              ) : null}
              <PressableScale
                style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
                onPress={onSave}
                disabled={saving || !name.trim()}
              >
                {saving ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </PressableScale>
              <TouchableOpacity onPress={onClose} disabled={saving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </RNAnimated.View>
          </Pressable>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
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
    dismiss: {
      flex: 1,
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.pill,
      borderTopRightRadius: radii.pill,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: Platform.OS === "ios" ? 36 : 24,
      gap: spacing.md,
      ...c.shadowRest,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: radii.xs,
      backgroundColor: c.borderLight,
      alignSelf: "center",
      marginBottom: spacing.md,
    },
    title: { color: c.text, ...typography.heading },
    input: {
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      color: c.text,
      ...typography.body,
    },
    timeFields: {
      gap: spacing.sm,
    },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      paddingVertical: 14,
      alignItems: "center",
    },
    saveBtnDisabled: {
      opacity: 0.5,
    },
    saveBtnText: { color: c.onPrimary, ...typography.bodyBold },
    cancelText: {
      color: c.textMuted,
      ...typography.bodyBold,
      textAlign: "center",
      paddingVertical: spacing.sm,
    },
  });
