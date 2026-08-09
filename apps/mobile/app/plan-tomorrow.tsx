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
import { Feather } from "@expo/vector-icons";
import { generateDailyInstances, supabase } from "../src/lib/supabase";
import { WEEKDAYS } from "../src/lib/schedule";
import { getLocalDateString, getTomorrowLocalDateString, minutesToTime } from "../src/lib/time";
import { handleError } from "../src/lib/errors";
import { useAuth } from "../src/providers/AuthProvider";
import { RequireAuth } from "../src/components/RequireAuth";
import { CloseTodayRow } from "../src/components/CloseTodayRow";
import { DailyInstance } from "../src/types/database";
import { colors, spacing, radii, typography, iconSizes } from "../src/theme";

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
  const [closeTodayInstances, setCloseTodayInstances] = useState<DailyInstance[]>([]);
  const [awaitingPresetIds, setAwaitingPresetIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadedDetails, setLoadedDetails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPlan = useCallback(async () => {
    if (!session.user.id) return;

    setLoading(true);
    try {
      await generateDailyInstances(tomorrowDate);

      const todayDate = getLocalDateString();

      const [tomorrowResult, closeTodayResult] = await Promise.all([
        supabase
          .from("daily_schedule_instances")
          .select("*, block:schedule_blocks(*)")
          .eq("user_id", session.user.id)
          .eq("date", tomorrowDate)
          .neq("status", "removed")
          .order("start_minutes"),
        supabase
          .from("daily_schedule_instances")
          .select("*, block:schedule_blocks!inner(*)")
          .eq("user_id", session.user.id)
          .eq("date", todayDate)
          .in("status", ["pending", "active"])
          .neq("block.category", "wind_down")
          .order("start_minutes"),
      ]);

      if (tomorrowResult.error) throw tomorrowResult.error;
      if (closeTodayResult.error) throw closeTodayResult.error;

      const rows = tomorrowResult.data ?? [];
      const details: Record<string, string> = {};
      for (const inst of rows) {
        details[inst.id] = inst.task_detail ?? "";
      }

      setInstances(rows);
      setCloseTodayInstances(closeTodayResult.data ?? []);
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

  const closeTodayLeft = closeTodayInstances.filter(
    (i) => i.status === "pending" || i.status === "active"
  ).length;
  const closeTodayVisible = closeTodayInstances.filter(
    (i) =>
      i.status === "pending" ||
      i.status === "active" ||
      awaitingPresetIds.has(i.id)
  );
  const showCloseToday = closeTodayVisible.length > 0;

  const handleCloseTodayStatus = async (
    instanceId: string,
    status: "completed" | "missed"
  ) => {
    const previous = closeTodayInstances;
    setCloseTodayInstances((prev) =>
      prev.map((i) => (i.id === instanceId ? { ...i, status } : i))
    );

    if (status === "missed") {
      setAwaitingPresetIds((prev) => new Set(prev).add(instanceId));
    } else {
      setAwaitingPresetIds((prev) => {
        const next = new Set(prev);
        next.delete(instanceId);
        return next;
      });
    }

    const { error } = await supabase
      .from("daily_schedule_instances")
      .update({ status })
      .eq("id", instanceId);

    if (error) {
      setCloseTodayInstances(previous);
      if (status === "missed") {
        setAwaitingPresetIds((prev) => {
          const next = new Set(prev);
          next.delete(instanceId);
          return next;
        });
      }
      handleError(error, "closeTodayStatus");
    }
  };

  const handlePresetTap = async (instanceId: string, tag: string) => {
    const previous = closeTodayInstances;
    setCloseTodayInstances((prev) =>
      prev.map((i) => (i.id === instanceId ? { ...i, miss_reason_tag: tag } : i))
    );
    setAwaitingPresetIds((prev) => {
      const next = new Set(prev);
      next.delete(instanceId);
      return next;
    });

    const { error } = await supabase
      .from("daily_schedule_instances")
      .update({ miss_reason_tag: tag })
      .eq("id", instanceId);

    if (error) {
      setCloseTodayInstances(previous);
      setAwaitingPresetIds((prev) => new Set(prev).add(instanceId));
      handleError(error, "closeTodayPreset");
    }
  };

  const handlePresetSkip = (instanceId: string) => {
    setAwaitingPresetIds((prev) => {
      const next = new Set(prev);
      next.delete(instanceId);
      return next;
    });
  };

  const handleSave = async () => {
    const changed = instances.filter((inst) => {
      const current = (drafts[inst.id] ?? "").trim();
      const original = (loadedDetails[inst.id] ?? "").trim();
      return current !== original;
    });

    if (!changed.length) {
      router.replace("/today");
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
      router.replace("/today");
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
          <TouchableOpacity onPress={() => router.replace("/today")} hitSlop={8}>
            <Feather name="x" size={iconSizes.md} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Tonight</Text>
            <Text style={styles.subtitle}>
              {tomorrowWeekday} · {tomorrowDate}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.replace("/today")} hitSlop={8}>
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
        {showCloseToday ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>
              Close today · {closeTodayLeft} left
            </Text>
            {closeTodayVisible.map((instance) => (
              <CloseTodayRow
                key={instance.id}
                instance={instance}
                onStatusTap={handleCloseTodayStatus}
                onPresetTap={handlePresetTap}
                onPresetSkip={handlePresetSkip}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Plan tomorrow</Text>
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
                  {fixed ? (
                    <Feather name="lock" size={iconSizes.sm} color={colors.textMuted} />
                  ) : null}
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
        </View>
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
  skipBtn: { color: colors.primary, ...typography.body },
  title: { fontSize: 24, fontWeight: "600", color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    color: colors.textMuted,
    ...typography.smallBold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
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
