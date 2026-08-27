import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Animated as RNAnimated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { DayBoundaryOverrides } from "../lib/schedule";
import { WEEKDAYS } from "./DayChips";
import { Colors, spacing, radii, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { TimePicker } from "./TimePicker";

const FALLBACK_WAKE = 6 * 60;
const FALLBACK_SLEEP = 22 * 60;

interface DayBoundariesSheetProps {
  visible: boolean;
  defaults: { wake: number | null; sleep: number | null };
  overrides: DayBoundaryOverrides;
  saving: boolean;
  onSave: (next: DayBoundaryOverrides) => void;
  onClose: () => void;
}

function cloneOverrides(src: DayBoundaryOverrides): DayBoundaryOverrides {
  const next: DayBoundaryOverrides = {};
  for (const [key, value] of Object.entries(src)) {
    next[key] = value ? { ...value } : value;
  }
  return next;
}

function patchField(
  draft: DayBoundaryOverrides,
  day: number,
  field: "wake" | "sleep",
  minutes: number | null
): DayBoundaryOverrides {
  const key = String(day);
  const current = { ...(draft[key] ?? {}) };
  if (minutes == null) {
    delete current[field];
  } else {
    current[field] = minutes;
  }
  const next = { ...draft };
  if (current.wake == null && current.sleep == null) {
    delete next[key];
  } else {
    next[key] = current;
  }
  return next;
}

export function DayBoundariesSheet({
  visible,
  defaults,
  overrides,
  saving,
  onSave,
  onClose,
}: DayBoundariesSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const slideAnim = useRef(new RNAnimated.Value(400)).current;
  const [draft, setDraft] = useState<DayBoundaryOverrides>({});

  useEffect(() => {
    if (!visible) return;
    setDraft(cloneOverrides(overrides));
  }, [visible, overrides]);

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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Pressable style={styles.overlayDismiss} onPress={onClose} />
        <RNAnimated.View
          style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <Text style={styles.title}>Wake and sleep by day</Text>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.rows}
          >
            {WEEKDAYS.map((day) => {
              const key = String(day.value);
              const dayOverride = draft[key];
              const wakeOverridden = dayOverride?.wake != null;
              const sleepOverridden = dayOverride?.sleep != null;
              const wakeValue =
                dayOverride?.wake ?? defaults.wake ?? FALLBACK_WAKE;
              const sleepValue =
                dayOverride?.sleep ?? defaults.sleep ?? FALLBACK_SLEEP;

              return (
                <View key={day.value} style={styles.dayBlock}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayLabel}>{day.label}</Text>
                    <PressableScale
                      onPress={() =>
                        setDraft((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        })
                      }
                      disabled={saving || (!wakeOverridden && !sleepOverridden)}
                    >
                      <Text style={styles.useDefault}>Use default</Text>
                    </PressableScale>
                  </View>
                  <View>
                    <TimePicker
                      label="Wake"
                      valueMinutes={wakeValue}
                      onChange={(minutes) =>
                        setDraft((prev) => patchField(prev, day.value, "wake", minutes))
                      }
                    />
                    {!wakeOverridden ? (
                      <Text style={styles.defaultHint}>default</Text>
                    ) : null}
                  </View>
                  <View>
                    <TimePicker
                      label="Sleep"
                      valueMinutes={sleepValue}
                      onChange={(minutes) =>
                        setDraft((prev) => patchField(prev, day.value, "sleep", minutes))
                      }
                    />
                    {!sleepOverridden ? (
                      <Text style={styles.defaultHint}>default</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <PressableScale
            style={styles.saveBtn}
            onPress={() => onSave(draft)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </PressableScale>
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
    title: {
      color: c.text,
      ...typography.heading,
      marginBottom: spacing.md,
    },
    rows: {
      gap: spacing.lg,
      paddingBottom: spacing.md,
    },
    dayBlock: {
      gap: spacing.xs,
      paddingBottom: spacing.md,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    dayHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dayLabel: {
      color: c.text,
      ...typography.bodyBold,
    },
    useDefault: {
      color: c.textMuted,
      ...typography.small,
    },
    defaultHint: {
      color: c.textMuted,
      ...typography.caption,
      marginTop: -spacing.xs,
      marginBottom: spacing.xs,
    },
    saveBtn: {
      marginTop: spacing.lg,
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      paddingVertical: 14,
      alignItems: "center",
    },
    saveBtnText: { color: c.onPrimary, ...typography.bodyBold },
  });
