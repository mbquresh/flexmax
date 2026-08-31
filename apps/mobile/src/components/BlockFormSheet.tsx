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
import { Feather } from "@expo/vector-icons";
import { BlockCategory, ScheduleBlock } from "../types/database";
import { Colors, spacing, radii, typography, iconSizes } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { TimePicker } from "./TimePicker";
import { CategoryChips } from "./CategoryChips";
import { DayChips, ALL_DAYS } from "./DayChips";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { getLocalDateString } from "../lib/time";
import { describeRecurrence, formatEndDate } from "../lib/recurrence";

export type BlockFormData = {
  name: string;
  category: BlockCategory;
  days: number[];
  startMinutes: number;
  endMinutes: number;
  isFixed: boolean;
  intervalWeeks: number;
  endsOn: string | null;
};

const EMPTY_DRAFT: BlockFormData = {
  name: "",
  category: "deep_work",
  days: ALL_DAYS,
  startMinutes: 9 * 60,
  endMinutes: 10 * 60,
  isFixed: false,
  intervalWeeks: 1,
  endsOn: null,
};

function parseLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

interface BlockFormSheetProps {
  visible: boolean;
  initial: ScheduleBlock | null;
  saving: boolean;
  error: string | null;
  onSave: (data: BlockFormData) => void;
  onClose: () => void;
  onDelete?: () => void;
}

export function BlockFormSheet({
  visible,
  initial,
  saving,
  error,
  onSave,
  onClose,
  onDelete,
}: BlockFormSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const slideAnim = useRef(new RNAnimated.Value(400)).current;
  const [draft, setDraft] = useState<BlockFormData>(EMPTY_DRAFT);
  // Expanded when ADDING, collapsed when EDITING. A new block's days are a
  // real decision and hiding them behind a tap would cost people the
  // setting; an existing block's recurrence is almost never changed.
  const [recurrenceOpen, setRecurrenceOpen] = useState(!initial);
  const [endPickerOpen, setEndPickerOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setRecurrenceOpen(!initial);
    setEndPickerOpen(false);
    setDraft(
      initial
        ? {
            name: initial.name,
            category: initial.category,
            days: initial.days_of_week,
            startMinutes: initial.start_minutes,
            endMinutes: initial.end_minutes,
            isFixed: initial.is_fixed,
            intervalWeeks: initial.interval_weeks ?? 1,
            endsOn: initial.ends_on,
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

  const handleEndsChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setEndPickerOpen(false);
      if (event.type === "dismissed") return;
    }
    if (selected) {
      setDraft((d) => ({ ...d, endsOn: getLocalDateString(selected) }));
    }
  };

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
            <PressableScale
              variant="highlight"
              baseColor={colors.surface}
              highlightColor={colors.surfaceNested}
              style={styles.recurrenceRow}
              onPress={() => setRecurrenceOpen((v) => !v)}
            >
              <Text style={styles.recurrenceLabel}>Repeats</Text>
              <Text style={styles.recurrenceValue} numberOfLines={1}>
                {describeRecurrence(draft.days, draft.intervalWeeks, draft.endsOn)}
              </Text>
              <Feather
                name={recurrenceOpen ? "chevron-up" : "chevron-down"}
                size={iconSizes.sm}
                color={colors.textSecondary}
              />
            </PressableScale>
            {recurrenceOpen ? (
              <>
                <DayChips
                  value={draft.days}
                  onChange={(days) => setDraft((d) => ({ ...d, days }))}
                />
                <View style={styles.stepperRow}>
                  <Text style={styles.stepperText}>Every</Text>
                  <PressableScale
                    style={styles.stepperBtn}
                    onPress={() =>
                      setDraft((d) => ({
                        ...d,
                        intervalWeeks: Math.max(1, d.intervalWeeks - 1),
                      }))
                    }
                    disabled={draft.intervalWeeks <= 1}
                  >
                    <Feather
                      name="minus"
                      size={iconSizes.sm}
                      color={
                        draft.intervalWeeks <= 1 ? colors.textSecondary : colors.text
                      }
                    />
                  </PressableScale>
                  <Text style={styles.stepperValue}>{draft.intervalWeeks}</Text>
                  <PressableScale
                    style={styles.stepperBtn}
                    onPress={() =>
                      setDraft((d) => ({
                        ...d,
                        intervalWeeks: Math.min(8, d.intervalWeeks + 1),
                      }))
                    }
                    disabled={draft.intervalWeeks >= 8}
                  >
                    <Feather
                      name="plus"
                      size={iconSizes.sm}
                      color={
                        draft.intervalWeeks >= 8 ? colors.textSecondary : colors.text
                      }
                    />
                  </PressableScale>
                  <Text style={styles.stepperText}>
                    {draft.intervalWeeks === 1 ? "week" : "weeks"}
                  </Text>
                </View>
                {draft.intervalWeeks > 1 ? (
                  <Text style={styles.intervalHelper}>
                    Counts from the first time this block runs.
                  </Text>
                ) : null}
                <PressableScale
                  variant="highlight"
                  baseColor={colors.surface}
                  highlightColor={colors.surfaceNested}
                  style={styles.recurrenceRow}
                  onPress={() => setEndPickerOpen((v) => !v)}
                >
                  <Text style={styles.recurrenceLabel}>Ends</Text>
                  <Text style={styles.recurrenceValue} numberOfLines={1}>
                    {draft.endsOn ? formatEndDate(draft.endsOn) : "Never"}
                  </Text>
                </PressableScale>
                {endPickerOpen ? (
                  <>
                    <DateTimePicker
                      value={draft.endsOn ? parseLocalYmd(draft.endsOn) : new Date()}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "calendar"}
                      minimumDate={new Date()}
                      onChange={handleEndsChange}
                      textColor={colors.text}
                    />
                    <PressableScale
                      style={styles.neverBtn}
                      onPress={() => {
                        setDraft((d) => ({ ...d, endsOn: null }));
                        setEndPickerOpen(false);
                      }}
                    >
                      <Text style={styles.neverBtnText}>Never</Text>
                    </PressableScale>
                  </>
                ) : null}
              </>
            ) : null}
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
            {onDelete ? (
              <>
                <View style={styles.deleteDivider} />
                <PressableScale
                  style={styles.deleteBtn}
                  onPress={onDelete}
                  disabled={saving}
                >
                  <Text style={styles.deleteBtnText}>Delete permanently</Text>
                </PressableScale>
              </>
            ) : null}
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
    recurrenceRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
    },
    recurrenceLabel: { color: c.text, ...typography.body },
    recurrenceValue: {
      flex: 1,
      textAlign: "right",
      color: c.textSecondary,
      ...typography.body,
      marginHorizontal: spacing.sm,
    },
    stepperRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    stepperBtn: {
      padding: spacing.sm,
      borderRadius: radii.md,
      backgroundColor: c.surfaceNested,
    },
    stepperValue: {
      color: c.text,
      ...typography.body,
      minWidth: 24,
      textAlign: "center",
    },
    stepperText: { color: c.textSecondary, ...typography.body },
    intervalHelper: { color: c.textSecondary, ...typography.body },
    neverBtn: {
      paddingVertical: spacing.sm,
      alignItems: "center",
    },
    neverBtnText: { color: c.textSecondary, ...typography.body },
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
    deleteDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginVertical: spacing.lg,
    },
    deleteBtn: {
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    deleteBtnText: {
      ...typography.body,
      color: c.danger,
    },
  });
