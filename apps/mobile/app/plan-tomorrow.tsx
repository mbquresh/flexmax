import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { generateDailyInstances, supabase } from "../src/lib/supabase";
import { WEEKDAYS } from "../src/lib/schedule";
import { getTomorrowLocalDateString, minutesToTime } from "../src/lib/time";
import { handleError } from "../src/lib/errors";
import { useAuth } from "../src/providers/AuthProvider";
import { RequireAuth } from "../src/components/RequireAuth";
import { DailyInstance } from "../src/types/database";
import { colors, spacing, radii, typography } from "../src/theme";

function isInstanceFixed(instance: DailyInstance): boolean {
  return instance.is_fixed || !!instance.block?.is_fixed;
}

function PlanTomorrowScreenContent() {
  const { session } = useAuth();
  if (!session) return null;

  const tomorrowDate = useMemo(() => getTomorrowLocalDateString(), []);
  const tomorrowWeekday = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return WEEKDAYS[t.getDay()].label;
  }, []);

  const [instances, setInstances] = useState<DailyInstance[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadedDetails, setLoadedDetails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPlan = useCallback(async () => {
    if (!session.user.id) return;

    setLoading(true);
    try {
      await generateDailyInstances(tomorrowDate);

      const { data, error } = await supabase
        .from("daily_schedule_instances")
        .select("*, block:schedule_blocks(*)")
        .eq("user_id", session.user.id)
        .eq("date", tomorrowDate)
        .neq("status", "removed")
        .order("start_minutes");

      if (error) throw error;

      const rows = data ?? [];
      const details: Record<string, string> = {};
      for (const inst of rows) {
        details[inst.id] = inst.task_detail ?? "";
      }

      setInstances(rows);
      setLoadedDetails(details);
      setDrafts({ ...details });
    } catch (err) {
      handleError(err, "loadPlanTomorrow");
    } finally {
      setLoading(false);
    }
  }, [session.user.id, tomorrowDate]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const updateDraft = (instanceId: string, text: string) => {
    setDrafts((prev) => ({ ...prev, [instanceId]: text }));
  };

  const handleSave = async () => {
    const changed = instances.filter((inst) => {
      const current = (drafts[inst.id] ?? "").trim();
      const original = (loadedDetails[inst.id] ?? "").trim();
      return current !== original;
    });

    if (!changed.length) {
      router.back();
      return;
    }

    setSaving(true);
    try {
      const results = await Promise.all(
        changed.map((inst) => {
          const trimmed = (drafts[inst.id] ?? "").trim();
          return supabase
            .from("daily_schedule_instances")
            .update({ task_detail: trimmed || null })
            .eq("id", inst.id);
        })
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      router.back();
    } catch (err) {
      handleError(err, "savePlanTomorrow", "Could not save tomorrow's plan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Plan tomorrow</Text>
            <Text style={styles.subtitle}>
              {tomorrowWeekday} · {tomorrowDate}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.skipBtn}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {instances.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No blocks scheduled for tomorrow.</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push("/schedule-builder")}
            >
              <Text style={styles.emptyBtnText}>Edit schedule</Text>
            </TouchableOpacity>
          </View>
        ) : (
          instances.map((instance) => {
            const fixed = isInstanceFixed(instance);
            return (
              <View
                key={instance.id}
                style={[styles.row, fixed && styles.rowFixed]}
              >
                <View style={styles.rowHeader}>
                  <Text style={styles.blockName}>
                    {instance.block?.name ?? "Block"}
                  </Text>
                  {fixed ? <Text style={styles.lockIcon}>🔒</Text> : null}
                </View>
                <Text style={styles.blockTime}>
                  {minutesToTime(instance.start_minutes)} –{" "}
                  {minutesToTime(instance.end_minutes)}
                </Text>
                <TextInput
                  style={styles.taskInput}
                  value={drafts[instance.id] ?? ""}
                  onChangeText={(text) => updateDraft(instance.id, text)}
                  placeholder="What will you actually do?"
                  placeholderTextColor={colors.textPlaceholder}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            );
          })
        )}
      </ScrollView>

      {instances.length > 0 ? (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.saveBtnText}>Save tomorrow's plan</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export default function PlanTomorrowScreen() {
  return (
    <RequireAuth>
      <PlanTomorrowScreenContent />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  closeBtn: { color: colors.textMuted, fontSize: 20, lineHeight: 22 },
  skipBtn: { color: colors.primary, ...typography.body },
  title: { fontSize: 24, fontWeight: "600", color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  rowFixed: {
    backgroundColor: colors.surfaceDim,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  blockName: { color: colors.text, fontSize: 16, fontWeight: "600" },
  lockIcon: { fontSize: 14 },
  blockTime: { color: colors.textMuted, fontSize: 13 },
  taskInput: {
    backgroundColor: colors.surfaceNested,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
    minHeight: 72,
  },
  empty: {
    alignItems: "center",
    marginTop: spacing.xxxl,
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    color: colors.textFaint,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyBtnText: { color: colors.onPrimary, ...typography.bodyBold },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: Platform.OS === "ios" ? 36 : spacing.xl,
    paddingTop: spacing.md,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  saveBtnText: { color: colors.onPrimary, fontSize: 16, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
});
