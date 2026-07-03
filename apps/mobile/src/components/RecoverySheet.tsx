import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { DailyInstance } from "../types/database";
import { minutesToTime } from "../lib/time";
import { colors, spacing, radii, typography } from "../theme";

export interface RecoveryAIContent {
  acknowledgment: string;
  reflection_prompt_why: string;
  reflection_prompt_improve: string;
  pattern_note: string | null;
}

export interface RescheduleSlot {
  start_minutes: number;
  end_minutes: number;
}

interface RecoverySheetProps {
  recoveryInstance: DailyInstance | null;
  recoveryAI: RecoveryAIContent | null;
  recoveryLoading: boolean;
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
  recoveryAI,
  recoveryLoading,
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

          {recoveryLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : (
            <>
              <Text style={styles.recoveryAck}>{recoveryAI?.acknowledgment}</Text>
              {recoveryAI?.pattern_note ? (
                <View style={styles.patternNote}>
                  <Text style={styles.patternNoteText}>{recoveryAI.pattern_note}</Text>
                </View>
              ) : null}
            </>
          )}

          <Text style={styles.reflectionLabel}>
            {recoveryAI?.reflection_prompt_why ?? "What got in the way?"}
          </Text>
          <TextInput
            style={styles.reflectionInput}
            value={reflectionWhy}
            onChangeText={onChangeWhy}
            placeholder="Be honest..."
            placeholderTextColor={colors.textPlaceholder}
            multiline
          />

          <Text style={styles.reflectionLabel}>
            {recoveryAI?.reflection_prompt_improve ?? "One thing you'd change next time?"}
          </Text>
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

          <View style={styles.recoveryActions}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={onSaveRecovery}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>Save reflection</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  recoverySheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.round,
    padding: spacing.xl,
    paddingBottom: 40,
    gap: spacing.md,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textDisabled,
    marginBottom: spacing.lg,
  },
  recoveryTitle: { color: colors.danger, ...typography.heading },
  recoveryAck: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  patternNote: {
    backgroundColor: colors.dangerTint,
    borderLeftWidth: 2,
    borderLeftColor: colors.danger,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  patternNoteText: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  reflectionLabel: { color: colors.textMuted, ...typography.smallBold },
  reflectionInput: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    minHeight: 60,
  },
  rescheduleBox: {
    backgroundColor: colors.successTint,
    borderRadius: radii.md,
    padding: 14,
    gap: 6,
  },
  rescheduleLabel: { color: colors.success, fontSize: 12, fontWeight: "600" },
  rescheduleTime: { color: colors.text, ...typography.bodyBold },
  rescheduleBtn: {
    backgroundColor: colors.success,
    borderRadius: radii.sm,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  rescheduleBtnText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  noSlot: { color: colors.textPlaceholder, fontSize: 13, fontStyle: "italic" },
  recoveryActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  saveBtnText: { color: colors.onPrimary, ...typography.bodyBold },
  skipText: { color: colors.textPlaceholder, fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});
