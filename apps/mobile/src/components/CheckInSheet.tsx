import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Animated as RNAnimated,
  Platform,
} from "react-native";
import { CompletionRating, DailyInstance } from "../types/database";
import { minutesToTime } from "../lib/time";
import { colors, spacing, radii } from "../theme";

const RATING_OPTIONS: { value: CompletionRating; label: string }[] = [
  { value: "crushed", label: "Crushed it" },
  { value: "partial", label: "Partly" },
  { value: "pulled_away", label: "Got pulled away" },
];

interface CheckInSheetProps {
  instance: DailyInstance | null;
  visible: boolean;
  slideAnim: RNAnimated.Value;
  saving: boolean;
  onRate: (rating: CompletionRating) => void;
  onClose: () => void;
}

export function CheckInSheet({
  instance,
  visible,
  slideAnim,
  saving,
  onRate,
  onClose,
}: CheckInSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <RNAnimated.View
            style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {instance?.block?.name ?? "Block"} — how'd it go?
            </Text>
            {instance ? (
              <Text style={styles.sheetTime}>
                {minutesToTime(instance.start_minutes)} – {minutesToTime(instance.end_minutes)}
              </Text>
            ) : null}

            <View style={styles.ratingRow}>
              {RATING_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={({ pressed }) => [
                    styles.ratingBtn,
                    pressed && styles.ratingBtnActive,
                  ]}
                  onPress={() => onRate(opt.value)}
                  disabled={saving}
                >
                  <Text style={styles.ratingBtnText}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>

            {saving ? (
              <ActivityIndicator color={colors.primary} style={styles.sheetSaving} />
            ) : null}
          </RNAnimated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textDisabled,
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  sheetTime: { color: colors.textMuted, fontSize: 14, marginBottom: spacing.xl, marginTop: 6 },
  ratingRow: { flexDirection: "row", gap: spacing.sm },
  ratingBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  ratingBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ratingBtnText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  sheetSaving: { marginTop: spacing.lg },
});
