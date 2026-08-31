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
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { AwayPeriod } from "../types/database";
import { Colors, spacing, radii, typography } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { formatAwayRange, isCurrent } from "../lib/away";
import { formatEndDate } from "../lib/recurrence";
import { getLocalDateString } from "../lib/time";

interface AwaySheetProps {
  visible: boolean;
  periods: AwayPeriod[];
  saving: boolean;
  onCreate: (startsOn: string, endsOn: string, label: string | null) => void;
  onDelete: (period: AwayPeriod) => void;
  onClose: () => void;
}

function parseLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function AwaySheet({
  visible,
  periods,
  saving,
  onCreate,
  onDelete,
  onClose,
}: AwaySheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const slideAnim = useRef(new RNAnimated.Value(400)).current;
  const [fromOn, setFromOn] = useState(getLocalDateString());
  const [toOn, setToOn] = useState(getLocalDateString());
  const [label, setLabel] = useState("");
  const [fromPickerOpen, setFromPickerOpen] = useState(false);
  const [toPickerOpen, setToPickerOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const today = getLocalDateString();
    setFromOn(today);
    setToOn(today);
    setLabel("");
    setFromPickerOpen(false);
    setToPickerOpen(false);
  }, [visible]);

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

  const handleFromChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setFromPickerOpen(false);
      if (event.type === "dismissed") return;
    }
    if (selected) {
      const next = getLocalDateString(selected);
      setFromOn(next);
      if (next > toOn) setToOn(next);
    }
  };

  const handleToChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setToPickerOpen(false);
      if (event.type === "dismissed") return;
    }
    if (selected) {
      setToOn(getLocalDateString(selected));
    }
  };

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
            contentContainerStyle={styles.content}
          >
            <Text style={styles.title}>Time away</Text>
            <Text style={styles.subtitle}>Nothing will be scheduled on these days.</Text>

            {periods.map((p) => (
              <View key={p.id} style={styles.periodRow}>
                <View style={styles.periodText}>
                  <View style={styles.periodTitleRow}>
                    <Text style={styles.periodRange}>{formatAwayRange(p)}</Text>
                    {isCurrent(p) ? <Text style={styles.nowTag}>Now</Text> : null}
                  </View>
                  {p.label ? <Text style={styles.periodLabel}>{p.label}</Text> : null}
                </View>
                <PressableScale
                  onPress={() => onDelete(p)}
                  disabled={saving}
                >
                  <Text style={styles.removeText}>Remove</Text>
                </PressableScale>
              </View>
            ))}

            <View style={styles.addSection}>
              <PressableScale
                variant="highlight"
                baseColor={colors.surface}
                highlightColor={colors.surfaceNested}
                style={styles.dateRow}
                onPress={() => {
                  setToPickerOpen(false);
                  setFromPickerOpen((v) => !v);
                }}
              >
                <Text style={styles.dateLabel}>From</Text>
                <Text style={styles.dateValue}>{formatEndDate(fromOn)}</Text>
              </PressableScale>
              {fromPickerOpen ? (
                <DateTimePicker
                  value={parseLocalYmd(fromOn)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "calendar"}
                  minimumDate={new Date()}
                  onChange={handleFromChange}
                  textColor={colors.text}
                />
              ) : null}
              <PressableScale
                variant="highlight"
                baseColor={colors.surface}
                highlightColor={colors.surfaceNested}
                style={styles.dateRow}
                onPress={() => {
                  setFromPickerOpen(false);
                  setToPickerOpen((v) => !v);
                }}
              >
                <Text style={styles.dateLabel}>To</Text>
                <Text style={styles.dateValue}>{formatEndDate(toOn)}</Text>
              </PressableScale>
              {toPickerOpen ? (
                <DateTimePicker
                  value={parseLocalYmd(toOn)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "calendar"}
                  minimumDate={parseLocalYmd(fromOn)}
                  onChange={handleToChange}
                  textColor={colors.text}
                />
              ) : null}
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder="Trip, illness, anything"
                placeholderTextColor={colors.textPlaceholder}
              />
              <PressableScale
                style={styles.addBtn}
                onPress={() =>
                  onCreate(fromOn, toOn, label.trim() ? label.trim() : null)
                }
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.addBtnText}>Add</Text>
                )}
              </PressableScale>
            </View>
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
    content: {
      gap: spacing.md,
    },
    title: {
      color: c.text,
      ...typography.bodyBold,
      textAlign: "center",
    },
    subtitle: {
      color: c.textMuted,
      ...typography.body,
      textAlign: "center",
    },
    periodRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      gap: spacing.md,
    },
    periodText: { flex: 1 },
    periodTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    periodRange: { color: c.text, ...typography.body },
    nowTag: {
      color: c.textSecondary,
      ...typography.caption,
    },
    periodLabel: { color: c.textSecondary, ...typography.small, marginTop: 2 },
    removeText: { color: c.danger, ...typography.body },
    addSection: { gap: spacing.sm, marginTop: spacing.sm },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
    },
    dateLabel: { color: c.text, ...typography.body },
    dateValue: {
      flex: 1,
      textAlign: "right",
      color: c.textSecondary,
      ...typography.body,
      marginHorizontal: spacing.sm,
    },
    input: {
      backgroundColor: c.surfaceNested,
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      color: c.text,
      fontSize: 15,
    },
    addBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    addBtnText: { color: c.onPrimary, ...typography.bodyBold },
  });
