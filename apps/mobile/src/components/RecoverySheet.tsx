import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { DailyInstance } from "../types/database";
import { RecoveryCopy } from "../lib/recoveryCopy";
import { minutesToTime } from "../lib/time";
import { Colors, spacing, radii, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

export interface RescheduleSlot {
  start_minutes: number;
  end_minutes: number;
}

interface RecoverySheetProps {
  recoveryInstance: DailyInstance | null;
  copy: RecoveryCopy | null;
  reflectionWhy: string;
  reflectionImprove: string;
  rescheduleSlot: RescheduleSlot | null;
  saving: boolean;
  onSaveRecovery: () => void;
  onReschedule: () => void;
  onChangeWhy: (text: string) => void;
  onChangeImprove: (text: string) => void;
  onClose: () => void;
}

export function RecoverySheet({
  recoveryInstance,
  copy,
  reflectionWhy,
  reflectionImprove,
  rescheduleSlot,
  saving,
  onSaveRecovery,
  onReschedule,
  onChangeWhy,
  onChangeImprove,
  onClose,
}: RecoverySheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal
      visible={!!recoveryInstance}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.recoverySheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.recoveryTitle}>
            {recoveryInstance?.block?.name ?? "Block"} — missed
          </Text>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
            keyboardShouldPersistTaps="handled"
          >
            {copy?.headline ? (
              <Text style={styles.recoveryAck}>{copy.headline}</Text>
            ) : null}
            {copy?.structuralNote ? (
              <View style={styles.patternNote}>
                <Text style={styles.patternNoteText}>{copy.structuralNote}</Text>
              </View>
            ) : null}

            {copy?.lastIntention ? (
              <View style={styles.lastIntention}>
                <Text style={styles.lastIntentionLabel}>Last time you wrote</Text>
                <Text style={styles.lastIntentionText}>"{copy.lastIntention.text}"</Text>
              </View>
            ) : null}

            <Text style={styles.reflectionLabel}>What got in the way?</Text>
            <TextInput
              style={styles.reflectionInput}
              value={reflectionWhy}
              onChangeText={onChangeWhy}
              placeholder="Be honest..."
              placeholderTextColor={colors.textPlaceholder}
              multiline
            />

            <Text style={styles.reflectionLabel}>One thing you'd change next time?</Text>
            <TextInput
              style={styles.reflectionInput}
              value={reflectionImprove}
              onChangeText={onChangeImprove}
              placeholder="Even something small..."
              placeholderTextColor={colors.textPlaceholder}
              multiline
            />

            {rescheduleSlot ? (
              <View style={styles.rescheduleBox}>
                <Text style={styles.rescheduleLabel}>Available slot today</Text>
                <Text style={styles.rescheduleTime}>
                  {minutesToTime(rescheduleSlot.start_minutes)} —{" "}
                  {minutesToTime(rescheduleSlot.end_minutes)}
                </Text>
                <TouchableOpacity
                  style={styles.rescheduleBtn}
                  onPress={onReschedule}
                  disabled={saving}
                >
                  <Text style={styles.rescheduleBtnText}>Reschedule to this slot</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.noSlot}>No open slots remaining today.</Text>
            )}
          </ScrollView>

          <View style={styles.recoveryActions}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={onSaveRecovery}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>Save reflection</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    recoverySheet: {
      backgroundColor: c.surface,
      borderRadius: radii.round,
      padding: spacing.xxl,
      paddingBottom: 40,
      maxHeight: "85%",
    },
    sheetHandle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.textDisabled,
      marginBottom: spacing.lg,
    },
    recoveryTitle: {
      color: c.text,
      ...typography.heading,
      marginBottom: spacing.sm,
    },
    recoveryAck: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 22,
      marginBottom: spacing.xl,
    },
    patternNote: {
      backgroundColor: c.surfaceNested,
      borderLeftWidth: 2,
      borderLeftColor: c.primary,
      borderRadius: radii.sm,
      padding: spacing.lg,
      marginBottom: spacing.xl,
    },
    patternNoteText: { color: c.text, fontSize: 13, lineHeight: 20 },
    lastIntention: {
      backgroundColor: c.surfaceNested,
      borderRadius: radii.sm,
      padding: spacing.lg,
      marginBottom: spacing.xl,
    },
    lastIntentionLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    lastIntentionText: {
      color: c.text,
      fontSize: 14,
      lineHeight: 21,
      fontStyle: "italic",
    },
    reflectionLabel: {
      color: c.textMuted,
      ...typography.smallBold,
      marginBottom: spacing.sm,
    },
    reflectionInput: {
      backgroundColor: c.surfaceNested,
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radii.md,
      padding: spacing.md,
      color: c.text,
      fontSize: 14,
      minHeight: 80,
      lineHeight: 20,
      marginBottom: spacing.xl,
    },
    rescheduleBox: {
      backgroundColor: c.successTint,
      borderRadius: radii.md,
      padding: 14,
      gap: 6,
      marginBottom: spacing.lg,
    },
    rescheduleLabel: { color: c.success, fontSize: 12, fontWeight: "600" },
    rescheduleTime: { color: c.text, ...typography.bodyBold },
    rescheduleBtn: {
      backgroundColor: c.success,
      borderRadius: radii.sm,
      paddingVertical: 10,
      alignItems: "center",
      marginTop: spacing.xs,
    },
    rescheduleBtnText: { color: c.text, fontSize: 14, fontWeight: "600" },
    noSlot: {
      color: c.textPlaceholder,
      fontSize: 13,
      fontStyle: "italic",
      marginBottom: spacing.lg,
    },
    recoveryActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.xs,
    },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xxl,
    },
    saveBtnText: { color: c.onPrimary, ...typography.bodyBold },
    skipText: { color: c.textPlaceholder, fontSize: 14 },
    btnDisabled: { opacity: 0.5 },
  });
