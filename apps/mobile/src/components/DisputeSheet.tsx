import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Animated as RNAnimated,
  Easing,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Colors, spacing, radii, typography, numeric } from "../theme";
import { useTheme } from "../providers/ThemeProvider";
import { PressableScale } from "./PressableScale";
import { hapticSelect } from "../lib/haptics";

const SHEET_OFFSET = 400;
const OPEN_DURATION = 220;
const CLOSE_DURATION = 180;

interface Props {
  belief: string | null;
  visible: boolean;
  saving: boolean;
  onSubmit: (note: string) => void;
  onClose: () => void;
}

export function DisputeSheet({
  belief,
  visible,
  saving,
  onSubmit,
  onClose,
}: Props) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const slideAnim = useRef(new RNAnimated.Value(SHEET_OFFSET)).current;
  const scrimAnim = useRef(new RNAnimated.Value(0)).current;
  const [note, setNote] = useState("");
  const scrimOpacity = scheme === "dark" ? 0.6 : 0.4;

  useEffect(() => {
    if (visible) {
      setNote("");
      slideAnim.setValue(SHEET_OFFSET);
      scrimAnim.setValue(0);
      RNAnimated.parallel([
        RNAnimated.timing(slideAnim, {
          toValue: 0,
          duration: OPEN_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        RNAnimated.timing(scrimAnim, {
          toValue: scrimOpacity,
          duration: OPEN_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, scrimAnim, scrimOpacity]);

  const close = () => {
    RNAnimated.parallel([
      RNAnimated.timing(slideAnim, {
        toValue: SHEET_OFFSET,
        duration: CLOSE_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      RNAnimated.timing(scrimAnim, {
        toValue: 0,
        duration: CLOSE_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  const canSubmit = note.trim().length > 0 && !saving;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <View style={styles.root}>
        <RNAnimated.View
          style={[styles.scrim, { opacity: scrimAnim }]}
          pointerEvents="none"
        />
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={styles.dismiss} onPress={saving ? undefined : close} />
          <RNAnimated.View
            style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
          >
            <View style={styles.handle} />
            <Text style={styles.title}>That&apos;s not right</Text>
            {belief ? <Text style={styles.belief}>{belief}</Text> : null}
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="What did I get wrong?"
              placeholderTextColor={colors.textPlaceholder}
              multiline
              autoFocus
              editable={!saving}
              maxLength={500}
            />
            <Text style={styles.counter}>
              {note.trim().length > 0 ? `${note.trim().length}` : " "}
            </Text>
            <PressableScale
              style={[styles.submit, !canSubmit && styles.submitDisabled]}
              onPress={() => {
                if (!canSubmit) return;
                hapticSelect();
                onSubmit(note.trim());
              }}
              disabled={!canSubmit}
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.submitText}>Correct this</Text>
              )}
            </PressableScale>
          </RNAnimated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
    },
    scrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlayScrim,
    },
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
    },
    dismiss: {
      flex: 1,
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.pill,
      borderTopRightRadius: radii.pill,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: Platform.OS === "ios" ? 36 : 24,
      ...c.shadowRest,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: radii.xs,
      backgroundColor: c.borderLight,
      alignSelf: "center",
      marginBottom: spacing.xl,
    },
    title: {
      color: c.text,
      ...typography.title,
      marginBottom: spacing.md,
    },
    belief: {
      color: c.textMuted,
      ...typography.body,
      marginBottom: spacing.xl,
    },
    input: {
      minHeight: 120,
      backgroundColor: c.surfaceNested,
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      color: c.text,
      ...typography.body,
      textAlignVertical: "top",
    },
    counter: {
      color: c.textFaint,
      ...typography.caption,
      ...numeric,
      textAlign: "right",
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
      minHeight: 16,
    },
    submit: {
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.lg,
      alignItems: "center",
    },
    submitDisabled: {
      opacity: 0.4,
    },
    submitText: {
      color: c.onPrimary,
      ...typography.bodyBold,
    },
  });
