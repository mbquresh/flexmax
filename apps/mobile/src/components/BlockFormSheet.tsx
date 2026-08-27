import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated as RNAnimated,
  KeyboardAvoidingView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { BlockCategory, ScheduleBlock } from "../types/database";
import { Colors, spacing, radii, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { TimePicker } from "./TimePicker";
import { CategoryChips } from "./CategoryChips";
import { DayChips, ALL_DAYS } from "./DayChips";

export type BlockFormData = {
  name: string;
  category: BlockCategory;
  days: number[];
  startMinutes: number;
  endMinutes: number;
  isFixed: boolean;
};

const EMPTY_DRAFT: BlockFormData = {
  name: "",
  category: "deep_work",
  days: ALL_DAYS,
  startMinutes: 9 * 60,
  endMinutes: 10 * 60,
  isFixed: false,
};

interface BlockFormSheetProps {
  visible: boolean;
  initial: ScheduleBlock | null;
  saving: boolean;
  error: string | null;
  onSave: (data: BlockFormData) => void;
  onClose: () => void;
}

export function BlockFormSheet({
  visible,
  initial,
  saving,
  error,
  onSave,
  onClose,
}: BlockFormSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const slideAnim = useRef(new RNAnimated.Value(400)).current;
  const [draft, setDraft] = useState<BlockFormData>(EMPTY_DRAFT);

  useEffect(() => {
    if (!visible) return;
    setDraft(
      initial
        ? {
            name: initial.name,
            category: initial.category,
            days: initial.days_of_week,
            startMinutes: initial.start_minutes,
            endMinutes: initial.end_minutes,
            isFixed: initial.is_fixed,
          }
        : EMPTY_DRAFT
    );
  }, [visible, initial]);

  useEffect(() => {
    if (!visible) return;
    slideAnim.setValue(400);
    RNAnimated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
    }).start();
  }, [visible, slideAnim]);

  const renderFixedToggle = (value: boolean, onToggle: () => void) => (
    <View style={styles.fixedToggleSection}>
      <TouchableOpacity
        style={[styles.fixedPill, value && styles.fixedPillActive]}
        onPress={onToggle}
      >
        <Text style={[styles.fixedPillText, value && styles.fixedPillTextActive]}>
          Fixed (can't be moved)
        </Text>
      </TouchableOpacity>
      <Text style={styles.fixedHelper}>
        Fixed blocks like work or commute stay locked in place.
      </Text>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Pressable style={styles.overlayDismiss} onPress={onClose} />
        <RNAnimated.View
          style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.form}
          >
            <Text style={styles.sectionTitle}>
              {initial ? initial.name : "Custom block"}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Block name (e.g. Deep work)"
              placeholderTextColor={colors.textPlaceholder}
              value={draft.name}
              onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
            />
            <CategoryChips
              value={draft.category}
              onChange={(category) => setDraft((d) => ({ ...d, category }))}
            />
            <Text style={styles.fieldLabel}>Repeat on</Text>
            <DayChips
              value={draft.days}
              onChange={(days) => setDraft((d) => ({ ...d, days }))}
            />
            <View style={styles.timeStack}>
              <TimePicker
                label="Starts"
                valueMinutes={draft.startMinutes}
                onChange={(startMinutes) => setDraft((d) => ({ ...d, startMinutes }))}
              />
              <TimePicker
                label="Ends"
                valueMinutes={draft.endMinutes}
                onChange={(endMinutes) => setDraft((d) => ({ ...d, endMinutes }))}
              />
            </View>
            {renderFixedToggle(draft.isFixed, () =>
              setDraft((d) => ({ ...d, isFixed: !d.isFixed }))
            )}
            {error ? <Text style={styles.errorLine}>{error}</Text> : null}
            <PressableScale
              style={styles.addBtn}
              onPress={() => onSave(draft)}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.addBtnText}>
                  {initial ? "Save changes" : "Add block"}
                </Text>
              )}
            </PressableScale>
          </ScrollView>
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
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.pill,
      borderTopRightRadius: radii.pill,
      paddingHorizontal: spacing.xxl,
      paddingBottom: Platform.OS === "ios" ? 36 : 24,
      paddingTop: spacing.xxl,
      maxHeight: "85%",
      ...c.shadowRest,
    },
    form: {
      gap: 10,
    },
    sectionTitle: { color: c.textMuted, ...typography.smallBold, marginBottom: 10 },
    input: {
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radii.lg,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      color: c.text,
      fontSize: 15,
    },
    fieldLabel: { color: c.textMuted, ...typography.smallBold },
    timeStack: { gap: 10 },
    fixedToggleSection: { gap: spacing.xs },
    fixedPill: {
      alignSelf: "flex-start",
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    fixedPillActive: {
      backgroundColor: c.primaryDeep,
      borderColor: c.primary,
    },
    fixedPillText: { color: c.textMuted, fontSize: 13, fontWeight: "600" },
    fixedPillTextActive: { color: c.onPrimary },
    fixedHelper: { color: c.textFaint, fontSize: 12, lineHeight: 18 },
    errorLine: {
      backgroundColor: c.errorTint,
      borderColor: c.errorBorder,
      borderWidth: 1,
      borderRadius: radii.md,
      padding: spacing.md,
      color: c.error,
      fontSize: 14,
    },
    addBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    addBtnText: { color: c.onPrimary, ...typography.bodyBold },
  });
