import React, { useMemo } from "react";
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
import { hapticSelect } from "../lib/haptics";
import { minutesToTime } from "../lib/time";
import { Colors, spacing, radii, typography, numeric } from "../theme";
import { useTheme } from "../providers/ThemeProvider";

const makeRatingOptions = (c: Colors): {
  value: CompletionRating;
  label: string;
  bg: string;
  text: string;
  border: string;
}[] => [
  {
    value: "crushed",
    label: "Crushed it",
    bg: c.ratingGoodBg,
    text: c.ratingGoodText,
    border: c.ratingGoodBorder,
  },
  {
    value: "partial",
    label: "Partly",
    bg: c.ratingOkayBg,
    text: c.ratingOkayText,
    border: c.ratingOkayBorder,
  },
  {
    value: "pulled_away",
    label: "Lost focus",
    bg: c.ratingBadBg,
    text: c.ratingBadText,
    border: c.ratingBadBorder,
  },
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ratingOptions = useMemo(() => makeRatingOptions(colors), [colors]);

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
              {ratingOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={({ pressed }) => [
                    styles.ratingBtn,
                    {
                      backgroundColor: opt.bg,
                      borderColor: opt.border,
                    },
                    pressed && styles.ratingBtnPressed,
                  ]}
                  onPress={() => {
                    hapticSelect();
                    onRate(opt.value);
                  }}
                  disabled={saving}
                >
                  <Text style={[styles.ratingBtnText, { color: opt.text }]}>{opt.label}</Text>
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

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.pill,
      borderTopRightRadius: radii.pill,
      paddingHorizontal: spacing.xxl,
      paddingBottom: Platform.OS === "ios" ? 36 : 24,
      paddingTop: 10,
      ...c.shadowRest,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.textDisabled,
      marginBottom: spacing.lg,
    },
    sheetTitle: {
      color: c.text,
      ...typography.heading,
    },
    sheetTime: { color: c.textMuted, ...typography.small, ...numeric, marginBottom: spacing.xl, marginTop: 6 },
    ratingRow: { flexDirection: "row", gap: spacing.sm },
    ratingBtn: {
      flex: 1,
      borderWidth: 2,
      borderRadius: radii.md,
      paddingVertical: 14,
      paddingHorizontal: 6,
      alignItems: "center",
    },
    ratingBtnPressed: {
      opacity: 0.85,
    },
    ratingBtnText: {
      ...typography.smallBold,
      textAlign: "center",
    },
    sheetSaving: { marginTop: spacing.lg },
  });
