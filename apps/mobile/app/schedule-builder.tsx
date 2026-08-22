import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
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
  CATEGORY_OPTIONS,
  createScheduleBlock,
  deleteScheduleBlock,
  ensureActiveTemplate,
  formatDays,
  WEEKDAYS,
} from "../src/lib/schedule";
import { useAuth } from "../src/providers/AuthProvider";
import { useTheme } from "../src/providers/ThemeProvider";
import { useStore } from "../src/store";
import { BlockCategory, ScheduleBlock } from "../src/types/database";
import { minutesToTime } from "../src/lib/time";
import { TimePicker } from "../src/components/TimePicker";
import { handleError, getErrorMessage, isConnectivityError } from "../src/lib/errors";

import { RequireAuth } from "../src/components/RequireAuth";
import { BrandLoader } from "../src/components/BrandLoader";
import { LoadError } from "../src/components/LoadError";
import { PressableScale } from "../src/components/PressableScale";
import { BoundaryRow } from "../src/components/BoundaryRow";
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

  const [name, setName] = useState("");
  const [category, setCategory] = useState<BlockCategory>("deep_work");
  const [startMinutes, setStartMinutes] = useState(9 * 60);
  const [endMinutes, setEndMinutes] = useState(10 * 60);
  const [selectedDays, setSelectedDays] = useState<number[]>(ALL_DAYS);
  const [isFixed, setIsFixed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<BlockCategory>("deep_work");
  const [editStartMinutes, setEditStartMinutes] = useState(9 * 60);
  const [editEndMinutes, setEditEndMinutes] = useState(10 * 60);
  const [editSelectedDays, setEditSelectedDays] = useState<number[]>(ALL_DAYS);
  const [editIsFixed, setEditIsFixed] = useState(false);
  const [wakeTarget, setWakeTarget] = useState<number | null>(null);
  const [sleepTarget, setSleepTarget] = useState<number | null>(null);

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
            .select("sleep_target_minutes, wake_target_minutes")
            .eq("id", session.user.id)
            .single(),
        ]);

      if (fetchError) throw fetchError;
      if (profileError) throw profileError;
      setBlocks(data ?? []);
      setWakeTarget(profileData?.wake_target_minutes ?? null);
      setSleepTarget(profileData?.sleep_target_minutes ?? null);
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

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const toggleEditDay = (day: number) => {
    setEditSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const openEditBlock = (block: ScheduleBlock) => {
    setEditingBlockId(block.id);
    setEditName(block.name);
    setEditCategory(block.category);
    setEditStartMinutes(block.start_minutes);
    setEditEndMinutes(block.end_minutes);
    setEditSelectedDays([...block.days_of_week]);
    setEditIsFixed(block.is_fixed ?? false);
  };

  const cancelEdit = () => {
    setEditingBlockId(null);
  };

  const handleSaveEdit = async (blockId: string) => {
    if (!editName.trim()) {
      showError("Give the block a name.");
      return;
    }
    if (!editSelectedDays.length) {
      showError("Pick at least one day for this block.");
      return;
    }
    if (editEndMinutes <= editStartMinutes) {
      showError("End time must be after start time.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("schedule_blocks")
        .update({
          name: editName.trim(),
          category: editCategory,
          days_of_week: editSelectedDays,
          start_minutes: editStartMinutes,
          end_minutes: editEndMinutes,
          is_fixed: editIsFixed,
        })
        .eq("id", blockId)
        .select()
        .single();

      if (error) throw error;

      setBlocks(
        blocks
          .map((b) => (b.id === blockId ? data : b))
          .sort((a, b) => a.start_minutes - b.start_minutes)
      );
      setEditingBlockId(null);
    } catch (err) {
      const message = getErrorMessage(err);
      handleError(err, "handleSaveEdit");
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlock = async (preset?: (typeof BLOCK_PRESETS)[number]) => {
    if (!templateId) return;
    Keyboard.dismiss();

    const blockName = preset?.name ?? name.trim();
    const blockCategory = preset?.category ?? category;
    const blockStart = preset?.startMinutes ?? startMinutes;
    const blockEnd = preset?.endMinutes ?? endMinutes;
    const daysOfWeek = selectedDays;

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
        isFixed,
      });
      setBlocks([...blocks, created].sort((a, b) => a.start_minutes - b.start_minutes));
      if (!preset) {
        setName("");
        setIsFixed(false);
        setAddOpen(false);
      }
    } catch (err) {
      const message = getErrorMessage(err);
      handleError(err, "handleAddBlock");
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    setSaving(true);
    setError(null);
    try {
      await deleteScheduleBlock(blockId);
      setBlocks(blocks.filter((b) => b.id !== blockId));
      if (editingBlockId === blockId) setEditingBlockId(null);
    } catch (err) {
      const message = getErrorMessage(err);
      handleError(err, "handleDeleteBlock");
      showError(message);
    } finally {
      setSaving(false);
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

  const renderAddForm = () => (
    <View style={styles.addSection}>
      {!addOpen ? (
        <PressableScale style={styles.addToggle} onPress={() => setAddOpen(true)}>
          <Text style={styles.addToggleText}>+ Add custom block</Text>
        </PressableScale>
      ) : (
        <View style={styles.form}>
          <View style={styles.formHeader}>
            <Text style={styles.sectionTitle}>Custom block</Text>
            <TouchableOpacity onPress={() => setAddOpen(false)} hitSlop={8}>
              <Text style={styles.collapseText}>Hide</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Block name (e.g. Deep work)"
            placeholderTextColor={colors.textPlaceholder}
            value={name}
            onChangeText={setName}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {CATEGORY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, category === opt.value && styles.chipActive]}
                onPress={() => setCategory(opt.value)}
              >
                <Text style={[styles.chipText, category === opt.value && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.fieldLabel}>Repeat on</Text>
          <View style={styles.dayRow}>
            {WEEKDAYS.map((day) => {
              const active = selectedDays.includes(day.value);
              return (
                <TouchableOpacity
                  key={day.value}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  onPress={() => toggleDay(day.value)}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                    {day.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.timeStack}>
            <TimePicker label="Starts" valueMinutes={startMinutes} onChange={setStartMinutes} />
            <TimePicker label="Ends" valueMinutes={endMinutes} onChange={setEndMinutes} />
          </View>
          {renderFixedToggle(isFixed, () => setIsFixed((prev) => !prev))}
          <PressableScale
            style={styles.addBtn}
            onPress={() => handleAddBlock()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.addBtnText}>Add block</Text>
            )}
          </PressableScale>
        </View>
      )}
    </View>
  );

  const renderBlock = ({ item }: { item: ScheduleBlock }) => (
    <PressableScale
      variant="highlight"
      baseColor={colors.surface}
      highlightColor={colors.surfaceNested}
      style={styles.blockCard}
      onPress={() => openEditBlock(item)}
      disabled={saving}
    >
      <View style={styles.blockHeader}>
        <Text style={styles.blockName}>{item.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => openEditBlock(item)} disabled={saving}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteBlock(item.id)} disabled={saving}>
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.blockMeta}>
        {minutesToTime(item.start_minutes)} – {minutesToTime(item.end_minutes)} ·{" "}
        {item.category.replace("_", " ")}
        {item.is_fixed ? (
          <>
            {" · "}
            <Feather name="lock" size={iconSizes.sm} color={colors.textMuted} />
            {" Fixed"}
          </>
        ) : null}
      </Text>
      <Text style={styles.blockRepeats}>Repeats: {formatDays(item.days_of_week)}</Text>

      {editingBlockId === item.id ? (
        <View style={[styles.form, { marginTop: 12 }]}>
          <Text style={styles.sectionTitle}>Edit block</Text>
          <TextInput
            style={styles.input}
            placeholder="Block name (e.g. Deep work)"
            placeholderTextColor={colors.textPlaceholder}
            value={editName}
            onChangeText={setEditName}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {CATEGORY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, editCategory === opt.value && styles.chipActive]}
                onPress={() => setEditCategory(opt.value)}
              >
                <Text
                  style={[styles.chipText, editCategory === opt.value && styles.chipTextActive]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.fieldLabel}>Repeat on</Text>
          <View style={styles.dayRow}>
            {WEEKDAYS.map((day) => {
              const active = editSelectedDays.includes(day.value);
              return (
                <TouchableOpacity
                  key={day.value}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  onPress={() => toggleEditDay(day.value)}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                    {day.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.timeStack}>
            <TimePicker
              label="Starts"
              valueMinutes={editStartMinutes}
              onChange={setEditStartMinutes}
            />
            <TimePicker
              label="Ends"
              valueMinutes={editEndMinutes}
              onChange={setEditEndMinutes}
            />
          </View>
          {renderFixedToggle(editIsFixed, () => setEditIsFixed((prev) => !prev))}
          <PressableScale
            style={styles.addBtn}
            onPress={() => handleSaveEdit(item.id)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.addBtnText}>Save changes</Text>
            )}
          </PressableScale>
          <TouchableOpacity onPress={cancelEdit} disabled={saving}>
            <Text style={styles.collapseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </PressableScale>
  );

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
        data={blocks}
        keyExtractor={(item) => item.id}
        renderItem={renderBlock}
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
            </View>
            {renderAddForm()}
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
          </>
        }
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
    blockCard: {
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: 10,
    },
    blockHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    blockName: { color: c.text, fontSize: 16, fontWeight: "600" },
    editText: { color: c.primary, fontSize: 13, fontWeight: "600" },
    removeText: { color: c.danger, fontSize: 13, fontWeight: "600" },
    blockMeta: { color: c.textMuted, fontSize: 13, marginTop: spacing.xs },
    blockRepeats: { color: c.textFaint, fontSize: 12, marginTop: 4, marginBottom: 10 },
    dayRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    dayChip: {
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    dayChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    dayChipText: { color: c.textFaint, fontSize: 12, fontWeight: "600" },
    dayChipTextActive: { color: c.onPrimary },
    fieldLabel: { color: c.textMuted, ...typography.smallBold },
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
    empty: {
      color: c.textFaint,
      textAlign: "center",
      lineHeight: 22,
      marginVertical: spacing.xxl,
      paddingHorizontal: spacing.sm,
    },
    addSection: { marginTop: spacing.sm, marginBottom: spacing.md },
    addToggle: {
      borderRadius: radii.lg,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingVertical: 14,
      alignItems: "center",
      backgroundColor: c.surface,
    },
    addToggleText: { color: c.primary, fontSize: 15, fontWeight: "500" },
    form: {
      borderRadius: radii.lg,
      borderWidth: 0.5,
      borderColor: c.border,
      padding: 14,
      gap: 10,
      backgroundColor: c.surfaceNested,
    },
    formHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    collapseText: { color: c.textFaint, fontSize: 13 },
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
    chipRow: { flexGrow: 0 },
    chip: {
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginRight: spacing.sm,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { color: c.textMuted, fontSize: 13 },
    chipTextActive: { color: c.onPrimary },
    timeStack: { gap: 10 },
    addBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    addBtnText: { color: c.onPrimary, ...typography.bodyBold },
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
