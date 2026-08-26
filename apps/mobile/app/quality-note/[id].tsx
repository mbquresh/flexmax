import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, spacing, radii, typography } from "../../src/theme";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useStore } from "../../src/store";
import { supabase } from "../../src/lib/supabase";
import { handleError } from "../../src/lib/errors";
import { PressableScale } from "../../src/components/PressableScale";
import { RequireAuth } from "../../src/components/RequireAuth";

function QualityNoteScreenContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const instance = useStore((s) => s.todayInstances.find((i) => i.id === id));
  const { updateInstance } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!instance) {
      router.back();
    }
  }, [instance]);

  const handleSave = async () => {
    if (!instance) return;
    const trimmed = draft.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("daily_schedule_instances")
        .update({ quality_reason_note: trimmed })
        .eq("id", instance.id);

      if (error) throw error;

      updateInstance(instance.id, { quality_reason_note: trimmed });
      router.back();
    } catch (err) {
      handleError(err, "qualityNote", "Couldn't save that");
    } finally {
      setSaving(false);
    }
  };

  if (!instance) return null;

  const blockName = instance.block?.name ?? "This block";
  const canSave = draft.trim().length > 0 && !saving;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {blockName} has been landing at half strength.
        </Text>
        <PressableScale onPress={() => router.back()} hitSlop={12}>
          <Feather name="x" size={22} color={colors.textSecondary} />
        </PressableScale>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.subheading}>What's actually going on?</Text>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="What's actually going on?"
          placeholderTextColor={colors.textPlaceholder}
          multiline
          autoFocus
          maxLength={500}
          editable={!saving}
        />
      </ScrollView>

      <View style={styles.footer}>
        <PressableScale
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save"}</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

export default function QualityNoteScreen() {
  return (
    <RequireAuth>
      <QualityNoteScreenContent />
    </RequireAuth>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xxl,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      gap: spacing.md,
    },
    title: {
      color: c.text,
      ...typography.heading,
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.xxl,
      paddingBottom: spacing.xxxl,
    },
    subheading: {
      color: c.textSecondary,
      ...typography.body,
      marginBottom: spacing.md,
    },
    input: {
      backgroundColor: c.surfaceNested,
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radii.md,
      padding: spacing.md,
      color: c.text,
      ...typography.body,
      minHeight: 120,
      textAlignVertical: "top",
    },
    footer: {
      paddingHorizontal: spacing.xxl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    saveBtnText: {
      ...typography.bodyBold,
      color: c.onPrimary,
    },
  });
