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
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { BlockCategory, ScheduleBlock } from "../types/database";
import { Colors, spacing, radii, typography, iconSizes } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { DragHandle } from "./DragHandle";
import { TimePicker } from "./TimePicker";
import { CategoryChips } from "./CategoryChips";
import { DayChips, ALL_DAYS, WEEKDAYS } from "./DayChips";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { getLocalDateString } from "../lib/time";
import {
  describeRecurrence,
  formatEndDate,
  resolveBlockTimes,
  setOverride,
  TimeOverrides,
} from "../lib/recurrence";

export type BlockFormData = {
  name: string;
  category: BlockCategory;
  days: number[];
  startMinutes: number;
  endMinutes: number;
  isFixed: boolean;
  intervalWeeks: number;
  endsOn: string | null;
  timeOverrides: TimeOverrides;
};

function emptyDraft(defaultDay?: number | null): BlockFormData {
  return {
    name: "",
    category: "deep_work",
    days: defaultDay != null ? [defaultDay] : ALL_DAYS,
    startMinutes: 9 * 60,
    endMinutes: 10 * 60,
    isFixed: false,
    intervalWeeks: 1,
    endsOn: null,
    timeOverrides: {},
  };
}

function weekdayLong(day: number): string {
  return WEEKDAYS[day]
    ? new Date(2026, 0, 4 + day).toLocaleDateString("en-US", { weekday: "long" })
    : "?";
}

function parseLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

interface BlockFormSheetProps {
  visible: boolean;
  initial: ScheduleBlock | null;
  saving: boolean;
  error: string | null;
  selectedDay?: number | null;
  defaultDay?: number | null;
  onSave: (data: BlockFormData) => void;
  onClose: () => void;
  onDelete?: () => void;
}

export function BlockFormSheet({
  visible,
  initial,
  saving,
  error,
  selectedDay = null,
  defaultDay = null,
  onSave,
  onClose,
  onDelete,
}: BlockFormSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const slideAnim = useRef(new RNAnimated.Value(400)).current;
  const [draft, setDraft] = useState<BlockFormData>(() => emptyDraft(defaultDay));
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
            timeOverrides: initial.time_overrides ?? {},
          }
        : emptyDraft(defaultDay)
    );
  }, [visible, initial, defaultDay]);

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
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>Movement</Text>
      <View style={styles.segment}>
        <PressableScale
          style={[styles.segmentItem, !value && styles.segmentItemActive]}
          onPress={() => {
            if (value) onToggle();
          }}
        >
          <DragHandle color={!value ? colors.text : colors.textMuted} />
          <Text style={[styles.segmentText, !value && styles.segmentTextActive]}>
            Flexible
          </Text>
        </PressableScale>
        <PressableScale
          style={[styles.segmentItem, value && styles.segmentItemActive]}
          onPress={() => {
            if (!value) onToggle();
          }}
        >
          <Feather
            name="lock"
            size={13}
            color={value ? colors.text : colors.textMuted}
          />
          <Text style={[styles.segmentText, value && styles.segmentTextActive]}>
            Fixed
          </Text>
        </PressableScale>
      </View>
      <Text style={styles.fieldHelper}>
        {value
          ? "Stays locked in place. Can't be swapped or rescheduled."
          : "Can be swapped, rescheduled, or moved around your day."}
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
          <View style={styles.grabber} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.form}
          >
            <Text style={styles.sectionTitle}>
              {initial ? "Edit block" : "New block"}
            </Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Block name (e.g. Deep work)"
                placeholderTextColor={colors.textPlaceholder}
                value={draft.name}
                onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Category</Text>
              <CategoryChips
                value={draft.category}
                onChange={(category) => setDraft((d) => ({ ...d, category }))}
              />
            </View>
            <View style={styles.fieldGroup}>
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
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Time</Text>
              <TimePicker
                label="Starts"
                valueMinutes={
                  selectedDay != null
                    ? resolveBlockTimes(
                        {
                          start_minutes: draft.startMinutes,
                          end_minutes: draft.endMinutes,
                          time_overrides: draft.timeOverrides,
                        },
                        selectedDay
                      ).start
                    : draft.startMinutes
                }
                onChange={(startMinutes) =>
                  setDraft((d) => {
                    if (selectedDay == null) return { ...d, startMinutes };
                    const current = resolveBlockTimes(
                      {
                        start_minutes: d.startMinutes,
                        end_minutes: d.endMinutes,
                        time_overrides: d.timeOverrides,
                      },
                      selectedDay
                    );
                    return {
                      ...d,
                      timeOverrides: setOverride(d.timeOverrides, selectedDay, {
                        start: startMinutes,
                        end: current.end,
                      }),
                    };
                  })
                }
              />
              <TimePicker
                label="Ends"
                valueMinutes={
                  selectedDay != null
                    ? resolveBlockTimes(
                        {
                          start_minutes: draft.startMinutes,
                          end_minutes: draft.endMinutes,
                          time_overrides: draft.timeOverrides,
                        },
                        selectedDay
                      ).end
                    : draft.endMinutes
                }
                onChange={(endMinutes) =>
                  setDraft((d) => {
                    if (selectedDay == null) return { ...d, endMinutes };
                    const current = resolveBlockTimes(
                      {
                        start_minutes: d.startMinutes,
                        end_minutes: d.endMinutes,
                        time_overrides: d.timeOverrides,
                      },
                      selectedDay
                    );
                    return {
                      ...d,
                      timeOverrides: setOverride(d.timeOverrides, selectedDay, {
                        start: current.start,
                        end: endMinutes,
                      }),
                    };
                  })
                }
              />
              <Text style={styles.fieldHelper}>
                {selectedDay != null
                  ? `Changing ${weekdayLong(selectedDay)} only`
                  : "Changing every day"}
              </Text>
              {selectedDay != null &&
              draft.timeOverrides[String(selectedDay)] != null ? (
                <PressableScale
                  onPress={() =>
                    setDraft((d) => ({
                      ...d,
                      timeOverrides: setOverride(d.timeOverrides, selectedDay, null),
                    }))
                  }
                >
                  <Text style={styles.overrideReset}>
                    {weekdayLong(selectedDay)} is different · Use the usual time
                  </Text>
                </PressableScale>
              ) : null}
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
      gap: spacing.lg,
    },
    fieldGroup: { gap: spacing.sm },
    fieldLabel: { color: c.textMuted, ...typography.smallBold },
    grabber: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: "center",
      marginBottom: spacing.md,
    },
    sectionTitle: {
      color: c.text,
      ...typography.bodyBold,
      textAlign: "center",
    },
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
      justifyContent: "center",
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
    intervalHelper: { color: c.textSecondary, ...typography.body, textAlign: "center" },
    neverBtn: {
      paddingVertical: spacing.sm,
      alignItems: "center",
    },
    neverBtnText: { color: c.textSecondary, ...typography.body },
    segment: {
      flexDirection: "row",
      backgroundColor: c.surfaceNested,
      borderRadius: radii.md,
      padding: 3,
    },
    segmentItem: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: radii.sm,
    },
    segmentItemActive: {
      backgroundColor: c.surface,
      ...c.shadowRest,
    },
    segmentText: { ...typography.body, color: c.textMuted },
    segmentTextActive: { color: c.text, fontWeight: "600" },
    fieldHelper: { color: c.textFaint, fontSize: 12, lineHeight: 18 },
    overrideReset: { color: c.textSecondary, ...typography.small },
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
      marginTop: spacing.md,
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
