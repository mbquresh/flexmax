import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Alert,
  Platform,
  Keyboard,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../src/lib/supabase";
import {
  ALL_DAYS,
  BLOCK_PRESETS,
  createScheduleBlock,
  deleteScheduleBlock,
  setBlockArchived,
  ensureActiveTemplate,
  DayBoundaryOverrides,
} from "../src/lib/schedule";
import { getLocalDateString } from "../src/lib/time";
import { useAuth } from "../src/providers/AuthProvider";
import { useTheme } from "../src/providers/ThemeProvider";
import { useStore } from "../src/store";
import { ScheduleBlock } from "../src/types/database";
import { handleError, getErrorMessage, isConnectivityError } from "../src/lib/errors";

import { RequireAuth } from "../src/components/RequireAuth";
import { BrandLoader } from "../src/components/BrandLoader";
import { LoadError } from "../src/components/LoadError";
import { PressableScale } from "../src/components/PressableScale";
import { BoundaryRow } from "../src/components/BoundaryRow";
import { ScheduleBlockCard } from "../src/components/ScheduleBlockCard";
import { BlockFormSheet, BlockFormData } from "../src/components/BlockFormSheet";
import { DayBoundariesSheet } from "../src/components/DayBoundariesSheet";
import { Colors, spacing, radii, typography, iconSizes } from "../src/theme";

function ScheduleBuilderScreenContent() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session, refreshProfile } = useAuth();
  const { blocks, setBlocks } = useStore();
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadOffline, setLoadOffline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null);
  const [wakeTarget, setWakeTarget] = useState<number | null>(null);
  const [sleepTarget, setSleepTarget] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<DayBoundaryOverrides>({});
  const [overridesOpen, setOverridesOpen] = useState(false);
  const [overridesSaving, setOverridesSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const activeBlocks = useMemo(
    () => blocks.filter((b) => b.is_active),
    [blocks]
  );
  const archivedBlocks = useMemo(
    () => blocks.filter((b) => !b.is_active),
    [blocks]
  );

  const loadBlocks = async () => {
    if (!session?.user.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadFailed(false);
    setError(null);
    try {
      const tid = await ensureActiveTemplate(session.user.id);
      setTemplateId(tid);

      const [{ data, error: fetchError }, { data: profileData, error: profileError }] =
        await Promise.all([
          supabase
            .from("schedule_blocks")
            .select("*")
            .eq("user_id", session.user.id)
            .order("start_minutes"),
          supabase
            .from("profiles")
            .select("sleep_target_minutes, wake_target_minutes, day_boundary_overrides")
            .eq("id", session.user.id)
            .single(),
        ]);

      if (fetchError) throw fetchError;
      if (profileError) throw profileError;
      setBlocks(data ?? []);
      setWakeTarget(profileData?.wake_target_minutes ?? null);
      setSleepTarget(profileData?.sleep_target_minutes ?? null);
      setOverrides(
        (profileData?.day_boundary_overrides as DayBoundaryOverrides | null) ?? {}
      );
    } catch (err) {
      setLoadFailed(true);
      setLoadOffline(isConnectivityError(err));
      handleError(err, "loadBlocks");
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlocks();
  }, [session?.user.id]);

  const handleDeleteBlock = useCallback(
    async (blockId: string) => {
      setSaving(true);
      setError(null);
      try {
        await deleteScheduleBlock(blockId);
        setBlocks(blocks.filter((b) => b.id !== blockId));
      } catch (err) {
        const message = getErrorMessage(err);
        handleError(err, "handleDeleteBlock");
        setError(message);
        if (Platform.OS !== "web") Alert.alert("Error", message);
      } finally {
        setSaving(false);
      }
    },
    [blocks, setBlocks]
  );

  // Deleting a block cascades to every daily_schedule_instances row for it.
  // The behavioural history is unrecoverable, so name the cost rather than
  // asking a generic "are you sure".
  const confirmDeleteBlock = useCallback(
    (blockId: string) => {
      const block = blocks.find((b) => b.id === blockId);
      const name = block?.name ?? "this block";

      if (Platform.OS === "web") {
        handleDeleteBlock(blockId);
        return;
      }

      Alert.alert(
        `Remove ${name}?`,
        "This also deletes its full history — every completion, miss, rating and reflection for this block. This can't be undone. Archive it instead if you just want it off your schedule.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => handleDeleteBlock(blockId),
          },
        ]
      );
    },
    [blocks, handleDeleteBlock]
  );

  const handleEditPress = useCallback((b: ScheduleBlock) => {
    setEditingBlock(b);
    setFormOpen(true);
  }, []);

  const handleArchiveToggle = useCallback(
    async (block: ScheduleBlock) => {
      const archiving = block.is_active;
      setSaving(true);
      setError(null);
      try {
        const updated = await setBlockArchived(block.id, archiving);

        if (archiving) {
          // Today's instance already exists; generation only prevents
          // FUTURE ones. Mark it removed rather than deleting it — 'removed'
          // is already excluded from every live-instance filter and from
          // the evidence pack's tracked/base CTEs.
          const { error: instErr } = await supabase
            .from("daily_schedule_instances")
            .update({ status: "removed" })
            .eq("block_id", block.id)
            .eq("date", getLocalDateString())
            .eq("status", "pending");
          if (instErr) handleError(instErr, "archiveClearInstance");
        } else {
          // Restore has to undo both halves. Generate first, which creates
          // today's instance if the block was archived on an earlier day and
          // generation has already run without it. It is a no-op when a row
          // already exists.
          const { error: genErr } = await supabase.rpc(
            "generate_my_daily_instances",
            { target_date: getLocalDateString() }
          );
          if (genErr) handleError(genErr, "restoreGenerate");

          // Then clear the tombstone from a same-day archive. Scoped to today
          // and to 'removed' so nothing historical is touched.
          const { error: instErr } = await supabase
            .from("daily_schedule_instances")
            .update({ status: "pending" })
            .eq("block_id", block.id)
            .eq("date", getLocalDateString())
            .eq("status", "removed");
          if (instErr) handleError(instErr, "restoreClearRemoved");
        }

        setBlocks(
          blocks
            .map((b) => (b.id === block.id ? updated : b))
            .sort((a, b) => a.start_minutes - b.start_minutes)
        );
      } catch (err) {
        const message = getErrorMessage(err);
        handleError(err, "handleArchiveToggle");
        setError(message);
        if (Platform.OS !== "web") Alert.alert("Error", message);
      } finally {
        setSaving(false);
      }
    },
    [blocks, setBlocks]
  );

  const renderItem = useCallback(
    ({ item }: { item: ScheduleBlock }) => (
      <ScheduleBlockCard
        block={item}
        onEdit={handleEditPress}
        onArchive={handleArchiveToggle}
        disabled={saving}
      />
    ),
    [handleEditPress, handleArchiveToggle, saving]
  );

  if (!session) return null;

  const showError = (message: string) => {
    setError(message);
    if (Platform.OS !== "web") Alert.alert("Error", message);
  };

  const saveBoundary = async (
    field: "wake_target_minutes" | "sleep_target_minutes",
    minutes: number
  ) => {
    const prevWake = wakeTarget;
    const prevSleep = sleepTarget;

    if (field === "wake_target_minutes") setWakeTarget(minutes);
    else setSleepTarget(minutes);

    const { error } =
      field === "wake_target_minutes"
        ? await supabase
            .from("profiles")
            .update({ wake_target_minutes: minutes })
            .eq("id", session.user.id)
        : await supabase
            .from("profiles")
            .update({ sleep_target_minutes: minutes })
            .eq("id", session.user.id);

    if (error) {
      setWakeTarget(prevWake);
      setSleepTarget(prevSleep);
      handleError(error, "saveBoundary", "Could not save");
      return;
    }

    await refreshProfile();
  };

  const saveDayOverrides = async (next: DayBoundaryOverrides) => {
    const prev = overrides;
    setOverrides(next);
    setOverridesSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ day_boundary_overrides: next })
        .eq("id", session.user.id);
      if (error) {
        setOverrides(prev);
        handleError(error, "saveDayOverrides", "Could not save");
        return;
      }
      await refreshProfile();
      setOverridesOpen(false);
    } finally {
      setOverridesSaving(false);
    }
  };

  const handleFormSave = async (data: BlockFormData) => {
    if (!data.name.trim()) {
      showError("Give the block a name.");
      return;
    }
    if (!data.days.length) {
      showError("Pick at least one day for this block.");
      return;
    }
    if (data.endMinutes <= data.startMinutes) {
      showError("End time must be after start time.");
      return;
    }

    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      if (editingBlock) {
        const { data: updated, error } = await supabase
          .from("schedule_blocks")
          .update({
            name: data.name.trim(),
            category: data.category,
            days_of_week: data.days,
            start_minutes: data.startMinutes,
            end_minutes: data.endMinutes,
            is_fixed: data.isFixed,
          })
          .eq("id", editingBlock.id)
          .select()
          .single();
        if (error) throw error;
        setBlocks(
          blocks
            .map((b) => (b.id === editingBlock.id ? updated : b))
            .sort((a, b) => a.start_minutes - b.start_minutes)
        );
      } else {
        if (!templateId) return;
        const created = await createScheduleBlock({
          userId: session.user.id,
          templateId,
          name: data.name.trim(),
          category: data.category,
          startMinutes: data.startMinutes,
          endMinutes: data.endMinutes,
          sortOrder: blocks.length,
          daysOfWeek: data.days,
          isFixed: data.isFixed,
        });
        setBlocks(
          [...blocks, created].sort((a, b) => a.start_minutes - b.start_minutes)
        );
      }
      setFormOpen(false);
      setEditingBlock(null);
    } catch (err) {
      const message = getErrorMessage(err);
      handleError(err, "handleFormSave");
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlock = async (preset: (typeof BLOCK_PRESETS)[number]) => {
    if (!templateId) return;
    Keyboard.dismiss();

    const blockName = preset.name;
    const blockCategory = preset.category;
    const blockStart = preset.startMinutes;
    const blockEnd = preset.endMinutes;
    const daysOfWeek = ALL_DAYS;

    if (!blockName) {
      showError("Give the block a name.");
      return;
    }
    if (!daysOfWeek.length) {
      showError("Pick at least one day for this block.");
      return;
    }
    if (blockEnd <= blockStart) {
      showError("End time must be after start time.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await createScheduleBlock({
        userId: session.user.id,
        templateId,
        name: blockName,
        category: blockCategory,
        startMinutes: blockStart,
        endMinutes: blockEnd,
        sortOrder: blocks.length,
        daysOfWeek,
        isFixed: false,
      });
      setBlocks([...blocks, created].sort((a, b) => a.start_minutes - b.start_minutes));
    } catch (err) {
      const message = getErrorMessage(err);
      handleError(err, "handleAddBlock");
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <BrandLoader size={56} />
      </View>
    );
  }

  if (loadFailed) {
    return (
      <View style={styles.centered}>
        <LoadError offline={loadOffline} onRetry={loadBlocks} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={activeBlocks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Build your schedule</Text>
              <Text style={styles.subtitle}>
                Tap Edit on a block to change its days, times, or name.
              </Text>
            </View>

            {error ? <Text style={styles.errorBox}>{error}</Text> : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick add</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {BLOCK_PRESETS.map((preset) => (
                  <PressableScale
                    key={preset.name}
                    style={styles.presetChip}
                    onPress={() => handleAddBlock(preset)}
                    disabled={saving}
                  >
                    <Text style={styles.presetText}>{preset.name}</Text>
                  </PressableScale>
                ))}
              </ScrollView>
            </View>

            <View style={styles.boundarySection}>
              <Text style={[styles.boundaryLabel, styles.wakeBoundaryLabel]}>Day starts</Text>
              <BoundaryRow
                label="Wake"
                minutes={wakeTarget}
                onChange={(m) => saveBoundary("wake_target_minutes", m)}
              />
              <PressableScale style={styles.overrideLink} onPress={() => setOverridesOpen(true)}>
                <Text style={styles.overrideLinkText}>
                  {Object.keys(overrides).length > 0
                    ? `Different on ${Object.keys(overrides).length} ${Object.keys(overrides).length === 1 ? "day" : "days"}`
                    : "Different on some days?"}
                </Text>
              </PressableScale>
            </View>
          </>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Tap a quick-add button above, or add a custom block below.
          </Text>
        }
        ListFooterComponent={
          <>
            <View style={styles.boundarySection}>
              <Text style={[styles.boundaryLabel, styles.sleepBoundaryLabel]}>Day ends</Text>
              <BoundaryRow
                label="Sleep"
                minutes={sleepTarget}
                onChange={(m) => saveBoundary("sleep_target_minutes", m)}
              />
              <PressableScale style={styles.overrideLink} onPress={() => setOverridesOpen(true)}>
                <Text style={styles.overrideLinkText}>
                  {Object.keys(overrides).length > 0
                    ? `Different on ${Object.keys(overrides).length} ${Object.keys(overrides).length === 1 ? "day" : "days"}`
                    : "Different on some days?"}
                </Text>
              </PressableScale>
            </View>
            <View style={styles.addSection}>
              <PressableScale
                style={styles.addToggle}
                onPress={() => {
                  setEditingBlock(null);
                  setFormOpen(true);
                }}
              >
                <Text style={styles.addToggleText}>+ Add custom block</Text>
              </PressableScale>
            </View>
            <PressableScale
              style={styles.primaryBtn}
              onPress={() => router.back()}
              disabled={blocks.length === 0}
            >
              <View style={styles.primaryBtnRow}>
                <Text style={styles.primaryBtnText}>Continue to today</Text>
                <Feather name="arrow-right" size={iconSizes.xs} color={colors.onPrimary} />
              </View>
            </PressableScale>
            {archivedBlocks.length > 0 ? (
              <View style={styles.archivedSection}>
                <PressableScale onPress={() => setShowArchived((v) => !v)}>
                  <Text style={styles.archivedToggle}>
                    {showArchived ? "Hide" : "Show"} archived ({archivedBlocks.length})
                  </Text>
                </PressableScale>
                {showArchived
                  ? archivedBlocks.map((b) => (
                      <ScheduleBlockCard
                        key={b.id}
                        block={b}
                        onEdit={handleEditPress}
                        onArchive={handleArchiveToggle}
                        disabled={saving}
                      />
                    ))
                  : null}
              </View>
            ) : null}
          </>
        }
      />
      <BlockFormSheet
        visible={formOpen}
        initial={editingBlock}
        saving={saving}
        error={error}
        onSave={handleFormSave}
        onClose={() => {
          setFormOpen(false);
          setEditingBlock(null);
        }}
        onDelete={
          editingBlock
            ? () => {
                const id = editingBlock.id;
                setFormOpen(false);
                setEditingBlock(null);
                confirmDeleteBlock(id);
              }
            : undefined
        }
      />
      <DayBoundariesSheet
        visible={overridesOpen}
        defaults={{ wake: wakeTarget, sleep: sleepTarget }}
        overrides={overrides}
        saving={overridesSaving}
        onSave={saveDayOverrides}
        onClose={() => setOverridesOpen(false)}
      />
    </View>
  );
}

export default function ScheduleBuilderScreen() {
  return (
    <RequireAuth>
      <ScheduleBuilderScreenContent />
    </RequireAuth>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    centered: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: "center",
      justifyContent: "center",
    },
    header: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
    title: { fontSize: 24, fontWeight: "600", color: c.text },
    subtitle: { fontSize: 14, color: c.textMuted, marginTop: 6 },
    boundaryLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: spacing.xxl,
      marginBottom: spacing.sm,
    },
    boundarySection: {
      marginBottom: spacing.xxl,
    },
    wakeBoundaryLabel: {
      // Quick add section already has marginBottom spacing.lg.
      marginTop: spacing.xxl - spacing.lg,
    },
    sleepBoundaryLabel: {
      // Block cards already have marginBottom 10.
      marginTop: spacing.xxl - 10,
    },
    errorBox: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.sm,
      backgroundColor: c.errorTint,
      borderColor: c.errorBorder,
      borderWidth: 1,
      borderRadius: radii.md,
      padding: spacing.md,
      color: c.error,
      fontSize: 14,
    },
    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
    section: { marginBottom: spacing.lg },
    sectionTitle: { color: c.textMuted, ...typography.smallBold, marginBottom: 10 },
    presetChip: {
      backgroundColor: c.primaryDeep,
      borderRadius: radii.round,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginRight: spacing.sm,
    },
    presetText: { color: c.onPrimary, fontSize: 14 },
    empty: {
      color: c.textFaint,
      textAlign: "center",
      lineHeight: 22,
      marginVertical: spacing.xxl,
      paddingHorizontal: spacing.sm,
    },
    addSection: { marginTop: spacing.sm, marginBottom: spacing.md },
    archivedSection: { marginTop: spacing.xl },
    archivedToggle: {
      ...typography.body,
      color: c.textSecondary,
      paddingVertical: spacing.md,
    },
    addToggle: {
      borderRadius: radii.lg,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingVertical: 14,
      alignItems: "center",
      backgroundColor: c.surface,
    },
    addToggleText: { color: c.primary, fontSize: 15, fontWeight: "500" },
    overrideLink: {
      marginTop: spacing.sm,
      alignSelf: "flex-start",
    },
    overrideLinkText: {
      color: c.textSecondary,
      ...typography.small,
    },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.lg,
      alignItems: "center",
    },
    primaryBtnRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    primaryBtnText: { color: c.onPrimary, fontSize: 16, fontWeight: "600" },
  });
