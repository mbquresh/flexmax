import React, { useEffect, useState } from "react";
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
import { loadScheduleTips } from "../src/lib/scheduleTips";
import { useAuth } from "../src/providers/AuthProvider";
import { useStore } from "../src/store";
import { BlockCategory, ScheduleBlock } from "../src/types/database";
import { minutesToTime } from "../src/lib/time";
import { TimePicker } from "../src/components/TimePicker";
import { handleError, getErrorMessage } from "../src/lib/errors";

import { RequireAuth } from "../src/components/RequireAuth";
import { colors, spacing, radii, typography } from "../src/theme";

function ScheduleBuilderScreenContent() {
  const { session, psychologyProfile, refreshProfile } = useAuth();
  if (!session) return null;

  const { blocks, setBlocks } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tips, setTips] = useState<string[]>([]);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tipsDismissed, setTipsDismissed] = useState(false);

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

  const loadBlocks = async () => {
    if (!session.user.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const tid = await ensureActiveTemplate(session.user.id);
      setTemplateId(tid);

      const { data, error: fetchError } = await supabase
        .from("schedule_blocks")
        .select("*")
        .eq("user_id", session.user.id)
        .order("start_minutes");

      if (fetchError) throw fetchError;
      setBlocks(data ?? []);
    } catch (err) {
      handleError(err, "loadBlocks");
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadTips = async () => {
    if (!psychologyProfile?.completed_at) return;

    if (psychologyProfile.schedule_tips?.length) {
      setTips(psychologyProfile.schedule_tips);
      return;
    }

    setTipsLoading(true);
    try {
      const loaded = await loadScheduleTips(psychologyProfile);
      setTips(loaded);
      await refreshProfile();
    } catch (err) {
      handleError(err, "loadTips");
    } finally {
      setTipsLoading(false);
    }
  };

  useEffect(() => {
    loadBlocks();
  }, [session.user.id]);

  useEffect(() => {
    loadTips();
  }, [psychologyProfile?.completed_at, psychologyProfile?.schedule_tips?.length]);

  const showError = (message: string) => {
    setError(message);
    if (Platform.OS !== "web") Alert.alert("Error", message);
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
      handleError(err, "handleSaveEdit", message);
      setError(message);
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
      handleError(err, "handleAddBlock", message);
      setError(message);
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
      handleError(err, "handleDeleteBlock", message);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const renderTipsCard = () => {
    if (tipsDismissed || !psychologyProfile?.completed_at) return null;

    if (tipsLoading) {
      return (
        <View style={styles.tipsCard}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }

    if (!tips.length) return null;

    return (
      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>
          Building your schedule — a few things to keep in mind.
        </Text>
        <ScrollView
          style={{ maxHeight: 200 }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          {tips.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.tipsDismissBtn} onPress={() => setTipsDismissed(true)}>
          <Text style={styles.tipsDismissText}>Got it</Text>
        </TouchableOpacity>
      </View>
    );
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
        <TouchableOpacity style={styles.addToggle} onPress={() => setAddOpen(true)}>
          <Text style={styles.addToggleText}>+ Add custom block</Text>
        </TouchableOpacity>
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
          <TouchableOpacity
            style={[styles.addBtn, saving && styles.btnDisabled]}
            onPress={() => handleAddBlock()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.addBtnText}>Add block</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderBlock = ({ item }: { item: ScheduleBlock }) => (
    <View style={styles.blockCard}>
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
        {item.is_fixed ? " · 🔒 Fixed" : ""}
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
          <TouchableOpacity
            style={[styles.addBtn, saving && styles.btnDisabled]}
            onPress={() => handleSaveEdit(item.id)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.addBtnText}>Save changes</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={cancelEdit} disabled={saving}>
            <Text style={styles.collapseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
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

            {renderTipsCard()}

            {error ? <Text style={styles.errorBox}>{error}</Text> : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick add</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {BLOCK_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.name}
                    style={styles.presetChip}
                    onPress={() => handleAddBlock(preset)}
                    disabled={saving}
                  >
                    <Text style={styles.presetText}>{preset.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
            {renderAddForm()}
            <TouchableOpacity
              style={[styles.primaryBtn, blocks.length === 0 && styles.btnDisabled]}
              onPress={() => router.replace("/today")}
              disabled={blocks.length === 0}
            >
              <Text style={styles.primaryBtnText}>Continue to today →</Text>
            </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  header: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  title: { fontSize: 24, fontWeight: "600", color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 6 },
  errorBox: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    backgroundColor: colors.errorTint,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.error,
    fontSize: 14,
  },
  tipsCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: colors.primaryTint,
    borderColor: colors.primary,
    borderWidth: 0.5,
    borderRadius: radii.md,
    padding: 14,
    gap: spacing.sm,
  },
  tipsTitle: { color: colors.primary, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  tipBullet: { color: colors.primary, fontSize: 14, lineHeight: 20 },
  tipText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  tipsDismissBtn: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 0.5,
    borderColor: colors.primary,
  },
  tipsDismissText: { color: colors.primary, ...typography.smallBold },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  section: { marginBottom: spacing.lg },
  sectionTitle: { color: colors.textMuted, ...typography.smallBold, marginBottom: 10 },
  presetChip: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radii.round,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: spacing.sm,
  },
  presetText: { color: colors.onPrimary, fontSize: 14 },
  blockCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: 10,
  },
  blockHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  blockName: { color: colors.text, fontSize: 16, fontWeight: "600" },
  editText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  removeText: { color: colors.danger, fontSize: 13, fontWeight: "600" },
  blockMeta: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
  blockRepeats: { color: colors.textFaint, fontSize: 12, marginTop: 4, marginBottom: 10 },
  dayRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dayChip: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayChipText: { color: colors.textFaint, fontSize: 12, fontWeight: "600" },
  dayChipTextActive: { color: colors.onPrimary },
  fieldLabel: { color: colors.textMuted, ...typography.smallBold },
  fixedToggleSection: { gap: spacing.xs },
  fixedPill: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  fixedPillActive: {
    backgroundColor: colors.primaryDeep,
    borderColor: colors.primary,
  },
  fixedPillText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  fixedPillTextActive: { color: colors.onPrimary },
  fixedHelper: { color: colors.textFaint, fontSize: 12, lineHeight: 18 },
  empty: {
    color: colors.textFaint,
    textAlign: "center",
    lineHeight: 22,
    marginVertical: spacing.xxl,
    paddingHorizontal: spacing.sm,
  },
  addSection: { marginTop: spacing.sm, marginBottom: spacing.md },
  addToggle: {
    borderRadius: radii.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  addToggleText: { color: colors.primary, fontSize: 15, fontWeight: "500" },
  form: {
    borderRadius: radii.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
    backgroundColor: colors.surfaceNested,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  collapseText: { color: colors.textFaint, fontSize: 13 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  chipRow: { flexGrow: 0 },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextActive: { color: colors.onPrimary },
  timeStack: { gap: 10 },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  addBtnText: { color: colors.onPrimary, ...typography.bodyBold },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.onPrimary, fontSize: 16, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
});
