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
  ScrollView,
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

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
            keyboardShouldPersistTaps="handled"
          >
            {recoveryLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Thinking about this one...</Text>
              </View>
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  recoverySheet: {
    backgroundColor: colors.surface,
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
    backgroundColor: colors.textDisabled,
    marginBottom: spacing.lg,
  },
  recoveryTitle: {
    color: colors.text,
    ...typography.heading,
    marginBottom: spacing.sm,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  recoveryAck: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  patternNote: {
    backgroundColor: colors.surfaceNested,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    borderRadius: radii.sm,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  patternNoteText: { color: colors.text, fontSize: 13, lineHeight: 20 },
  reflectionLabel: {
    color: colors.textMuted,
    ...typography.smallBold,
    marginBottom: spacing.sm,
  },
  reflectionInput: {
    backgroundColor: colors.surfaceNested,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    minHeight: 80,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  rescheduleBox: {
    backgroundColor: colors.successTint,
    borderRadius: radii.md,
    padding: 14,
    gap: 6,
    marginBottom: spacing.lg,
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
  noSlot: {
    color: colors.textPlaceholder,
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
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  saveBtnText: { color: colors.onPrimary, ...typography.bodyBold },
  skipText: { color: colors.textPlaceholder, fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});
