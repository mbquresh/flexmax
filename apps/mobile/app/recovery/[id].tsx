import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { BehavioralInsight, DailyInstance } from "../../src/types/database";
import { RecoveryCopy, buildRecoveryCopy, findInsightForBlock } from "../../src/lib/recoveryCopy";
import { minutesToTime, getLocalDateString, formatDuration } from "../../src/lib/time";
import {
  findRescheduleSlot,
  getFallbackSlot,
  placeShrunkBlock,
  planDisplacement,
  planShrinkToFit,
  resolveDayBoundaries,
  MIN_BLOCK_MINUTES,
} from "../../src/lib/schedule";
import { hapticSelect } from "../../src/lib/haptics";
import { Colors, spacing, radii, typography } from "../../src/theme";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAuth } from "../../src/providers/AuthProvider";
import { useStore } from "../../src/store";
import { supabase } from "../../src/lib/supabase";
import { handleError } from "../../src/lib/errors";
import { scheduleTodayBlockNotifications } from "../../src/lib/blockNotifications";
import { TimePicker } from "../../src/components/TimePicker";
import { DurationSlider } from "../../src/components/DurationSlider";
import { PressableScale } from "../../src/components/PressableScale";
import { RequireAuth } from "../../src/components/RequireAuth";

// Retained ONLY to filter tapped chip labels out of the "Last time you
// wrote" callback below. The capture UI was removed; these six strings
// still exist in historical rows and must never be quoted back to the
// user as something they wrote.
const LEGACY_IMPROVE_CHIPS = [
  "Start earlier",
  "Make it shorter",
  "Different time of day",
  "Prep the night before",
  "Break it into steps",
] as const;

function RecoveryScreenContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const instance = useStore((s) => s.todayInstances.find((i) => i.id === id));
  const allInstances = useStore((s) => s.todayInstances);
  const { setTodayInstances, updateInstance } = useStore();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const todayBounds = useMemo(
    () =>
      resolveDayBoundaries(
        new Date().getDay(),
        {
          wake: profile?.wake_target_minutes ?? null,
          sleep: profile?.sleep_target_minutes ?? null,
        },
        profile?.day_boundary_overrides
      ),
    [profile]
  );

  const [recoveryCopy, setRecoveryCopy] = useState<RecoveryCopy | null>(null);
  const [reflectionWhy, setReflectionWhy] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState<{
    start_minutes: number;
    end_minutes: number;
  } | null>(null);
  const [slotIsFallback, setSlotIsFallback] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(slotIsFallback);

  useEffect(() => {
    if (!instance) {
      router.back();
    }
  }, [instance]);

  useEffect(() => {
    if (!instance) return;

    const found = findRescheduleSlot(
      { ...instance, status: "missed" },
      useStore.getState().todayInstances,
      todayBounds.sleep,
      todayBounds.wake
    );
    setSlotIsFallback(found === null);
    setRescheduleSlot(found ?? getFallbackSlot(instance));
    setReflectionWhy("");

    let cancelled = false;

    (async () => {
      let recent: { date: string; status: string }[] = [];
      let lastNoteRow: {
        date: string;
        reflection_why: string | null;
        reflection_improve: string | null;
      } | null = null;
      let insights: BehavioralInsight[] = [];

      try {
        const { data: recentData } = await supabase
          .from("daily_schedule_instances")
          .select("date, status")
          .eq("block_id", instance.block_id)
          .order("date", { ascending: false })
          .limit(14);

        recent = recentData ?? [];

        // Separate, wider lookup: the user's most recent forward-looking note on
        // this block, however long ago. The 14-row streak window is far too narrow
        // — intentions are written rarely (~1 in 3 misses) and stay relevant.
        const { data: lastNoteRowData } = await supabase
          .from("daily_schedule_instances")
          .select("date, reflection_why, reflection_improve")
          .eq("user_id", session!.user.id)
          .eq("block_id", instance.block_id)
          .neq("id", instance.id)
          .or("reflection_why.not.is.null,reflection_improve.not.is.null")
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();

        lastNoteRow = lastNoteRowData ?? null;

        const { data: insightsData } = await supabase
          .from("behavioral_insights")
          .select("id, kind, belief, suggestion, related_blocks, rank, generated_at, nudge_line")
          .eq("superseded", false)
          .order("rank");

        insights = insightsData ?? [];
      } catch (err) {
        handleError(err, "handleMarkMissed lookups");
      }

      if (cancelled) return;

      // Prefer the forward-looking note; fall back to the cause. Both are the
      // user's own words, which is what makes this land.
      // A tapped chip is not the user's own words. Quoting one back as
      // "Last time you wrote" is the same error the evidence pack forbids
      // for miss_reason_tag. Typed improve notes are still preferred —
      // they are forward-looking, which is what lands in a recovery moment.
      const improveNote = lastNoteRow?.reflection_improve?.trim() || null;
      const typedImprove =
        improveNote && !LEGACY_IMPROVE_CHIPS.includes(improveNote as never)
          ? improveNote
          : null;
      const noteText = typedImprove || lastNoteRow?.reflection_why?.trim() || null;

      const copy = buildRecoveryCopy(
        instance.block?.name ?? "this block",
        recent,
        getLocalDateString(),
        noteText ? { text: noteText, date: lastNoteRow!.date } : null
      );
      const insight = copy.suppressInsight
        ? null
        : findInsightForBlock(insights, instance.block?.name ?? "");
      setRecoveryCopy({
        ...copy,
        structuralNote: insight?.belief ?? copy.structuralNote,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [instance?.id]);

  useEffect(() => {
    setAdjustOpen(slotIsFallback);
  }, [instance?.id, slotIsFallback]);

  const blockDuration =
    instance != null
      ? instance.end_minutes - instance.start_minutes
      : 0;

  const handleStartAdjust = (start: number) => {
    hapticSelect();
    const currentDuration = rescheduleSlot
      ? rescheduleSlot.end_minutes - rescheduleSlot.start_minutes
      : blockDuration;
    setRescheduleSlot({ start_minutes: start, end_minutes: start + currentDuration });
  };

  const handleEndAdjust = (end: number) => {
    hapticSelect();
    if (!rescheduleSlot) return;
    const start = rescheduleSlot.start_minutes;
    const clamped = Math.max(end, start + MIN_BLOCK_MINUTES);
    setRescheduleSlot({ start_minutes: start, end_minutes: clamped });
  };

  const pastBedtime =
    todayBounds.sleep != null &&
    rescheduleSlot != null &&
    rescheduleSlot.end_minutes > todayBounds.sleep;

  const plan = useMemo(
    () =>
      rescheduleSlot && instance
        ? planDisplacement(
            rescheduleSlot,
            allInstances,
            instance.id,
            todayBounds.sleep,
            todayBounds.wake
          )
        : ({ kind: "clear" } as const),
    [rescheduleSlot, allInstances, instance?.id, todayBounds]
  );

  // The fallback under the sacrifice offer: shorten the collider instead of
  // removing it. Single-target only — see ShrinkToFitPlan.
  const shrinkPlan = useMemo(() => {
    if (!rescheduleSlot || !instance) return null;
    if (plan.kind !== "sacrifice" || plan.targets.length !== 1) return null;
    const target = plan.targets[0];
    if (!target) return null;
    return planShrinkToFit(
      rescheduleSlot,
      target,
      allInstances,
      instance.id,
      todayBounds.sleep,
      todayBounds.wake
    );
  }, [rescheduleSlot, instance?.id, plan, allInstances, todayBounds]);

  const [shrinkMinutes, setShrinkMinutes] = useState<number | null>(null);

  // Back to 50% whenever the offer itself changes. A duration carried over
  // from a different block or a different slot is a stale answer to a
  // question the user has not been asked yet.
  useEffect(() => {
    setShrinkMinutes(null);
  }, [shrinkPlan?.target.id, shrinkPlan?.maxMinutes, shrinkPlan?.originalMinutes]);

  const shrinkValue = shrinkPlan
    ? Math.min(shrinkMinutes ?? shrinkPlan.defaultMinutes, shrinkPlan.maxMinutes)
    : 0;

  const shrinkPlacement = useMemo(
    () =>
      shrinkPlan && rescheduleSlot && instance
        ? placeShrunkBlock(
            rescheduleSlot,
            shrinkPlan.target,
            shrinkValue,
            allInstances,
            instance.id,
            todayBounds.sleep,
            todayBounds.wake
          )
        : null,
    [shrinkPlan, shrinkValue, rescheduleSlot, instance?.id, allInstances, todayBounds]
  );

  const shrinkIsFullLength =
    shrinkPlan != null && shrinkValue >= shrinkPlan.originalMinutes;

  const sacrificeWarning =
    plan.kind !== "sacrifice"
      ? null
      : plan.names.length === 1
        ? `Rescheduling here removes ${plan.names[0]}.`
        : `Rescheduling here removes ${plan.names.length} blocks: ${plan.names.join(", ")}.`;

  const blockedMessage =
    plan.kind === "blocked"
      ? `${plan.names[0]} is fixed and can't move. Pick another time.`
      : null;

  const commitMissed = async (instanceId: string, extra = {}) => {
    const { error } = await supabase
      .from("daily_schedule_instances")
      .update({ status: "missed", ...extra })
      .eq("id", instanceId);

    if (error) throw error;
    updateInstance(instanceId, { status: "missed", ...extra });
  };

  const handleSkipRecovery = async () => {
    if (!instance) return;
    const instanceId = instance.id;

    setSaving(true);
    try {
      await commitMissed(instanceId);
      router.back();
    } catch (err) {
      handleError(err, "handleSkipRecovery", "Could not mark missed");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRecovery = async () => {
    if (!instance) return;

    setSaving(true);
    try {
      await commitMissed(instance.id, {
        reflection_why: reflectionWhy.trim() || null,
      });
      router.back();
    } catch (err) {
      handleError(err, "handleSaveRecovery", "Could not save reflection");
    } finally {
      setSaving(false);
    }
  };

  const rescheduleProvenance = (inst: DailyInstance) => {
    const isFirstReschedule = (inst.reschedule_count ?? 0) === 0;
    return {
      status: "pending" as const,
      rescheduled_to_id: null,
      reschedule_count: (inst.reschedule_count ?? 0) + 1,
      ...(isFirstReschedule
        ? {
            original_start_minutes: inst.start_minutes,
            original_end_minutes: inst.end_minutes,
          }
        : {}),
    };
  };

  // Two rows must move together. swap_instance_times (008) is a generic
  // ownership-validated "set both instances' times in one transaction" — it
  // carries no swap-specific logic. Sequential updates here would allow a
  // half-commit that leaves a real overlap in the database, which is the
  // failure the whole displacement resolver exists to prevent.
  //
  // Shared by push and shrink-to-fit. Both are the same operation.
  const commitPairedMove = async (params: {
    self: DailyInstance;
    selfStart: number;
    selfEnd: number;
    targetId: string;
    targetStart: number;
    targetEnd: number;
    targetExtra?: Partial<DailyInstance>;
  }) => {
    const provenance = rescheduleProvenance(params.self);
    const payload = {
      start_minutes: params.selfStart,
      end_minutes: params.selfEnd,
      ...provenance,
    };

    const { error: rpcError } = await supabase.rpc("swap_instance_times", {
      instance_a_id: params.self.id,
      a_start: params.selfStart,
      a_end: params.selfEnd,
      instance_b_id: params.targetId,
      b_start: params.targetStart,
      b_end: params.targetEnd,
    });
    if (rpcError) throw rpcError;

    // Provenance second, deliberately. Times are already correct and
    // non-overlapping, so a failure here loses metadata, never schedule
    // integrity.
    const { error: provError } = await supabase
      .from("daily_schedule_instances")
      .update(provenance)
      .eq("id", params.self.id);
    if (provError) handleError(provError, "handleReschedule provenance");

    if (params.targetExtra) {
      const { error: extraError } = await supabase
        .from("daily_schedule_instances")
        .update(params.targetExtra)
        .eq("id", params.targetId);
      if (extraError) handleError(extraError, "handleReschedule targetProvenance");
    }

    const targetPayload = {
      start_minutes: params.targetStart,
      end_minutes: params.targetEnd,
      ...(params.targetExtra ?? {}),
    };

    updateInstance(params.self.id, payload);
    updateInstance(params.targetId, targetPayload);

    const updatedInstances = allInstances
      .map((i) =>
        i.id === params.self.id
          ? { ...i, ...payload }
          : i.id === params.targetId
            ? { ...i, ...targetPayload }
            : i
      )
      .sort((a, b) => a.start_minutes - b.start_minutes);

    setTodayInstances(updatedInstances);
    const { todayInsights, todayPreempt } = useStore.getState();
    scheduleTodayBlockNotifications(
      updatedInstances,
      getLocalDateString(),
      todayInsights,
      todayPreempt
    ).catch((err) => handleError(err, "recoveryResync"));
  };

  // The collider survives at a reduced length instead of being removed.
  // original_start/end_minutes on the target records what it was before the
  // compression; reschedule_count is deliberately NOT bumped, matching push
  // — the user rescheduled the missed block, not this one.
  const handleShrinkAndMove = async () => {
    if (!instance || !rescheduleSlot || !shrinkPlan || !shrinkPlacement) return;

    const target = shrinkPlan.target;
    const compressed =
      !shrinkIsFullLength && target.original_start_minutes == null
        ? {
            original_start_minutes: target.start_minutes,
            original_end_minutes: target.end_minutes,
          }
        : undefined;

    setSaving(true);
    try {
      await commitPairedMove({
        self: instance,
        selfStart: rescheduleSlot.start_minutes,
        selfEnd: rescheduleSlot.end_minutes,
        targetId: target.id,
        targetStart: shrinkPlacement.start,
        targetEnd: shrinkPlacement.end,
        targetExtra: compressed,
      });
      router.back();
    } catch (err) {
      handleError(err, "handleShrinkAndMove", "Couldn't shorten the block");
    } finally {
      setSaving(false);
    }
  };

  const handleReschedule = async () => {
    if (!instance || !rescheduleSlot) return;
    if (plan.kind === "blocked") return;

    const provenance = rescheduleProvenance(instance);
    const payload = {
      start_minutes: rescheduleSlot.start_minutes,
      end_minutes: rescheduleSlot.end_minutes,
      ...provenance,
    };

    setSaving(true);
    try {
      if (plan.kind === "push") {
        await commitPairedMove({
          self: instance,
          selfStart: rescheduleSlot.start_minutes,
          selfEnd: rescheduleSlot.end_minutes,
          targetId: plan.target.id,
          targetStart: plan.newStart,
          targetEnd: plan.newEnd,
        });
        router.back();
        return;
      }

      if (plan.kind === "sacrifice") {
        const { error: dropError } = await supabase
          .from("daily_schedule_instances")
          .update({
            status: "removed",
            removed_by: "displacement",
            displaced_by_id: instance.id,
          })
          .in("id", plan.targets.map((t) => t.id));

        if (dropError) throw dropError;
        plan.targets.forEach((t) =>
          updateInstance(t.id, {
            status: "removed",
            removed_by: "displacement",
            displaced_by_id: instance.id,
          })
        );
      }

      const { error } = await supabase
        .from("daily_schedule_instances")
        .update(payload)
        .eq("id", instance.id);
      if (error) throw error;

      updateInstance(instance.id, payload);

      const droppedIds =
        plan.kind === "sacrifice"
          ? new Set(plan.targets.map((t) => t.id))
          : null;

      const updatedInstances = allInstances
        .map((i) =>
          i.id === instance.id
            ? { ...i, ...payload }
            : droppedIds?.has(i.id)
              ? {
                  ...i,
                  status: "removed" as const,
                  removed_by: "displacement",
                  displaced_by_id: instance.id,
                }
              : i
        )
        .sort((a, b) => a.start_minutes - b.start_minutes);

      setTodayInstances(updatedInstances);
      const { todayInsights, todayPreempt } = useStore.getState();
      scheduleTodayBlockNotifications(
        updatedInstances,
        getLocalDateString(),
        todayInsights,
        todayPreempt
      ).catch((err) => handleError(err, "recoveryResync"));

      router.back();
    } catch (err) {
      handleError(err, "handleReschedule", "Couldn't reschedule the block");
    } finally {
      setSaving(false);
    }
  };

  if (!instance) return null;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {instance.block?.name ?? "Block"} — missed
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
        {recoveryCopy?.headline ? (
          <Text style={styles.recoveryAck}>{recoveryCopy.headline}</Text>
        ) : null}
        {recoveryCopy?.structuralNote ? (
          <View style={styles.patternNote}>
            <Text style={styles.patternNoteText}>{recoveryCopy.structuralNote}</Text>
          </View>
        ) : null}

        {recoveryCopy?.lastIntention ? (
          <View style={styles.lastIntention}>
            <Text style={styles.lastIntentionLabel}>Last time you wrote</Text>
            <Text style={styles.lastIntentionText}>"{recoveryCopy.lastIntention.text}"</Text>
          </View>
        ) : null}

        <Text style={styles.reflectionLabel}>What got in the way?</Text>
        <TextInput
          style={styles.reflectionInput}
          value={reflectionWhy}
          onChangeText={setReflectionWhy}
          placeholder="What happened?"
          placeholderTextColor={colors.textPlaceholder}
          multiline
        />

        {rescheduleSlot ? (
          <View style={styles.rescheduleBox}>
            <Text style={styles.rescheduleLabel}>
              {slotIsFallback ? "Pick a time" : "Available slot today"}
            </Text>
            <View style={styles.rescheduleTimeRow}>
              <Text style={styles.rescheduleTime}>
                {minutesToTime(rescheduleSlot.start_minutes)} —{" "}
                {minutesToTime(rescheduleSlot.end_minutes)}
              </Text>
              <TouchableOpacity
                onPress={() => setAdjustOpen((open) => !open)}
                hitSlop={8}
              >
                <Text style={styles.adjustLink}>Adjust</Text>
              </TouchableOpacity>
            </View>
            {adjustOpen ? (
              <>
                <TimePicker
                  label="Starts"
                  valueMinutes={rescheduleSlot.start_minutes}
                  onChange={handleStartAdjust}
                />
                <TimePicker
                  label="Ends"
                  valueMinutes={rescheduleSlot.end_minutes}
                  onChange={handleEndAdjust}
                />
              </>
            ) : null}
            {pastBedtime && plan.kind !== "blocked" ? (
              <View style={styles.bedtimeNote}>
                <Text style={styles.bedtimeNoteText}>
                  This runs past your usual bedtime.
                </Text>
              </View>
            ) : null}
            {plan.kind === "push" ? (
              <View style={styles.collisionNote}>
                <Text style={styles.bedtimeNoteText}>
                  This overlaps {plan.target.block?.name ?? "another block"}. Moving it to{" "}
                  {minutesToTime(plan.newStart)} makes room.
                </Text>
              </View>
            ) : sacrificeWarning ? (
              <View style={styles.collisionNote}>
                <Text style={styles.bedtimeNoteText}>{sacrificeWarning}</Text>
              </View>
            ) : blockedMessage ? (
              <View style={styles.collisionNote}>
                <Text style={styles.bedtimeNoteText}>{blockedMessage}</Text>
              </View>
            ) : null}

            {/* A blocked plan disables the commit rather than offering a second
                button. The affordance to choose another time is the picker directly
                above — the refusal message explains why this time will not work, and
                the button re-enables the moment the picker produces a slot that does. */}
            <PressableScale
              style={[
                styles.rescheduleBtn,
                plan.kind === "blocked" && styles.rescheduleBtnBlocked,
              ]}
              onPress={handleReschedule}
              disabled={saving || plan.kind === "blocked"}
            >
              <Text
                style={[
                  styles.rescheduleBtnText,
                  plan.kind === "blocked" && styles.rescheduleBtnTextBlocked,
                ]}
              >
                {plan.kind === "push"
                  ? `Reschedule and move ${plan.target.block?.name ?? "another block"}`
                  : plan.kind === "sacrifice"
                    ? "Reschedule and remove"
                    : slotIsFallback
                      ? "Reschedule to this time"
                      : "Reschedule to this slot"}
              </Text>
            </PressableScale>

            {/* Only under a sacrifice. Push already keeps the collider whole,
                and offering to shorten a block that does not need shortening
                would turn a resolved decision back into a question. */}
            {shrinkPlan && shrinkPlacement ? (
              <View style={styles.shrinkBox}>
                <Text style={styles.shrinkLabel}>
                  Or keep {shrinkPlan.name}, shorter
                </Text>
                <DurationSlider
                  min={shrinkPlan.minMinutes}
                  max={shrinkPlan.maxMinutes}
                  value={shrinkValue}
                  onChange={setShrinkMinutes}
                  formatValue={formatDuration}
                />
                <Text style={styles.shrinkSentence}>
                  {shrinkIsFullLength
                    ? `${shrinkPlan.name} keeps its full ${formatDuration(
                        shrinkPlan.originalMinutes
                      )} and moves to ${minutesToTime(shrinkPlacement.start)}.`
                    : `${shrinkPlan.name} drops from ${formatDuration(
                        shrinkPlan.originalMinutes
                      )} to ${formatDuration(shrinkValue)} and moves to ${minutesToTime(
                        shrinkPlacement.start
                      )}.`}
                </Text>
                <PressableScale
                  style={styles.shrinkBtn}
                  onPress={handleShrinkAndMove}
                  disabled={saving}
                >
                  <Text style={styles.shrinkBtnText}>
                    {shrinkIsFullLength
                      ? "Reschedule and move"
                      : "Reschedule and shorten"}
                  </Text>
                </PressableScale>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PressableScale style={styles.saveBtn} onPress={handleSaveRecovery} disabled={saving}>
          <Text style={styles.saveBtnText}>Save reflection</Text>
        </PressableScale>
        <PressableScale onPress={handleSkipRecovery} disabled={saving}>
          <Text style={styles.skipText}>Skip</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

export default function RecoveryScreen() {
  return (
    <RequireAuth>
      <RecoveryScreenContent />
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
    recoveryAck: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 22,
      marginBottom: spacing.xl,
    },
    patternNote: {
      backgroundColor: c.surfaceNested,
      borderLeftWidth: 2,
      borderLeftColor: c.primary,
      borderRadius: radii.sm,
      padding: spacing.lg,
      marginBottom: spacing.xl,
    },
    patternNoteText: { color: c.text, fontSize: 13, lineHeight: 20 },
    lastIntention: {
      backgroundColor: c.surfaceNested,
      borderRadius: radii.sm,
      padding: spacing.lg,
      marginBottom: spacing.xl,
    },
    lastIntentionLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    lastIntentionText: {
      color: c.text,
      fontSize: 14,
      lineHeight: 21,
      fontStyle: "italic",
    },
    reflectionLabel: {
      color: c.textMuted,
      ...typography.smallBold,
      marginBottom: spacing.sm,
    },
    reflectionInput: {
      backgroundColor: c.surfaceNested,
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radii.md,
      padding: spacing.md,
      color: c.text,
      fontSize: 14,
      minHeight: 80,
      lineHeight: 20,
      marginBottom: spacing.xl,
    },
    rescheduleBox: {
      backgroundColor: c.successTint,
      borderRadius: radii.md,
      padding: 14,
      gap: 6,
      marginBottom: spacing.lg,
    },
    rescheduleLabel: { color: c.success, fontSize: 12, fontWeight: "600" },
    rescheduleTimeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    rescheduleTime: { color: c.text, ...typography.bodyBold, flex: 1 },
    adjustLink: { color: c.primary, ...typography.smallBold },
    bedtimeNote: {
      backgroundColor: c.surfaceNested,
      borderLeftWidth: 2,
      borderLeftColor: c.primary,
      borderRadius: radii.sm,
      padding: spacing.md,
    },
    bedtimeNoteText: { color: c.text, fontSize: 13, lineHeight: 20 },
    collisionNote: {
      backgroundColor: c.surfaceNested,
      borderLeftWidth: 2,
      borderLeftColor: c.primary,
      borderRadius: radii.sm,
      padding: spacing.md,
    },
    rescheduleBtn: {
      backgroundColor: c.success,
      borderRadius: radii.sm,
      paddingVertical: 10,
      alignItems: "center",
      marginTop: spacing.xs,
    },
    rescheduleBtnText: { color: c.text, fontSize: 14, fontWeight: "600" },
    rescheduleBtnBlocked: {
      backgroundColor: c.surfaceNested,
    },
    rescheduleBtnTextBlocked: {
      color: c.textSecondary,
    },
    shrinkBox: {
      backgroundColor: c.surfaceNested,
      borderRadius: radii.sm,
      padding: spacing.md,
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    shrinkLabel: {
      color: c.textMuted,
      ...typography.smallBold,
    },
    shrinkSentence: { color: c.text, fontSize: 13, lineHeight: 20 },
    shrinkBtn: {
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: c.success,
      paddingVertical: 10,
      alignItems: "center",
      marginTop: spacing.xs,
    },
    shrinkBtnText: { color: c.text, fontSize: 14, fontWeight: "600" },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xxl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xxl,
    },
    saveBtnText: { color: c.onPrimary, ...typography.bodyBold },
    skipText: { color: c.textPlaceholder, fontSize: 14 },
  });
