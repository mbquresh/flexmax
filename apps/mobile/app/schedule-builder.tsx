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
  updateBlockDays,
  WEEKDAYS,
} from "../src/lib/schedule";
import { useAuth } from "../src/providers/AuthProvider";
import { useStore } from "../src/store";
import { BlockCategory, ScheduleBlock } from "../src/types/database";
import { minutesToTime } from "../src/lib/time";
import { TimeField } from "../src/components/TimeField";

export default function ScheduleBuilderScreen() {
  const { session } = useAuth();
  const { blocks, setBlocks } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<BlockCategory>("deep_work");
  const [startTime, setStartTime] = useState("9:00 AM");
  const [endTime, setEndTime] = useState("10:00 AM");
  const [selectedDays, setSelectedDays] = useState<number[]>(ALL_DAYS);

  const loadBlocks = async () => {
    if (!session?.user.id) return;

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
      setError(err instanceof Error ? err.message : "Could not load schedule");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlocks();
  }, [session?.user.id]);

  const showError = (message: string) => {
    setError(message);
    if (Platform.OS !== "web") Alert.alert("Error", message);
  };

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleToggleBlockDay = async (block: ScheduleBlock, day: number) => {
    const next = block.days_of_week.includes(day)
      ? block.days_of_week.filter((d) => d !== day)
      : [...block.days_of_week, day].sort((a, b) => a - b);

    if (!next.length) {
      showError("Each block needs at least one day.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateBlockDays(block.id, next);
      setBlocks(
        blocks
          .map((b) => (b.id === block.id ? updated : b))
          .sort((a, b) => a.start_minutes - b.start_minutes)
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not update days");
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlock = async (preset?: (typeof BLOCK_PRESETS)[number]) => {
    if (!session?.user.id || !templateId) return;
    Keyboard.dismiss();

    const blockName = preset?.name ?? name.trim();
    const blockCategory = preset?.category ?? category;
    const blockStart = preset?.startTime ?? startTime.trim();
    const blockEnd = preset?.endTime ?? endTime.trim();
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
        startTime: blockStart,
        endTime: blockEnd,
        sortOrder: blocks.length,
        daysOfWeek,
      });
      setBlocks([...blocks, created].sort((a, b) => a.start_minutes - b.start_minutes));
      if (!preset) {
        setName("");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not add block");
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
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not delete block");
    } finally {
      setSaving(false);
    }
  };

  const renderBlock = ({ item }: { item: ScheduleBlock }) => (
    <View style={styles.blockCard}>
      <View style={styles.blockHeader}>
        <Text style={styles.blockName}>{item.name}</Text>
        <TouchableOpacity onPress={() => handleDeleteBlock(item.id)}>
          <Text style={styles.deleteText}>Remove</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.blockMeta}>
        {minutesToTime(item.start_minutes)} – {minutesToTime(item.end_minutes)} ·{" "}
        {formatDays(item.days_of_week)} · {item.category.replace("_", " ")}
      </Text>
      <View style={styles.dayRow}>
        {WEEKDAYS.map((day) => {
          const active = item.days_of_week.includes(day.value);
          return (
            <TouchableOpacity
              key={day.value}
              style={[styles.dayChip, active && styles.dayChipActive]}
              onPress={() => handleToggleBlockDay(item, day.value)}
              disabled={saving}
            >
              <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                {day.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#534AB7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Build your schedule</Text>
        <Text style={styles.subtitle}>
          Tap the day letters on each block to control when it repeats.
        </Text>
      </View>

      {error ? <Text style={styles.errorBox}>{error}</Text> : null}

      <FlatList
        data={blocks}
        keyExtractor={(item) => item.id}
        renderItem={renderBlock}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
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
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Tap a quick-add button above, or create your own block below.
          </Text>
        }
      />

      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Add a block</Text>
        <TextInput
          style={styles.input}
          placeholder="Block name (e.g. Deep work)"
          placeholderTextColor="#555"
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
        <View style={styles.timeRow}>
          <TimeField label="Start" value={startTime} onChange={setStartTime} />
          <Text style={styles.timeSep}>to</Text>
          <TimeField label="End" value={endTime} onChange={setEndTime} />
        </View>
        <TouchableOpacity
          style={[styles.addBtn, saving && styles.btnDisabled]}
          onPress={() => handleAddBlock()}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addBtnText}>+ Add block</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, blocks.length === 0 && styles.btnDisabled]}
        onPress={() => router.replace("/today")}
        disabled={blocks.length === 0}
      >
        <Text style={styles.primaryBtnText}>Continue to today →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f12" },
  centered: {
    flex: 1,
    backgroundColor: "#0f0f12",
    alignItems: "center",
    justifyContent: "center",
  },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "600", color: "#f0f0f0" },
  subtitle: { fontSize: 14, color: "#888", marginTop: 6 },
  errorBox: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: "#3a1f1f",
    borderColor: "#7a3030",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: "#ffb4b4",
    fontSize: 14,
  },
  list: { paddingHorizontal: 16, paddingBottom: 8, flexGrow: 0 },
  section: { marginBottom: 16 },
  sectionTitle: { color: "#888", fontSize: 13, marginBottom: 10, fontWeight: "600" },
  presetChip: {
    backgroundColor: "#2d2250",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
  },
  presetText: { color: "#EEEDFE", fontSize: 14 },
  blockCard: {
    backgroundColor: "#1e1e28",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  blockHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  blockName: { color: "#f0f0f0", fontSize: 16, fontWeight: "600" },
  deleteText: { color: "#888", fontSize: 13 },
  blockMeta: { color: "#888", fontSize: 13, marginTop: 4, marginBottom: 10 },
  dayRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dayChip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#1a1a1a",
    borderWidth: 0.5,
    borderColor: "#333",
  },
  dayChipActive: { backgroundColor: "#534AB7", borderColor: "#534AB7" },
  dayChipText: { color: "#666", fontSize: 12, fontWeight: "600" },
  dayChipTextActive: { color: "#EEEDFE" },
  fieldLabel: { color: "#888", fontSize: 13, fontWeight: "600" },
  empty: { color: "#666", textAlign: "center", marginVertical: 24, lineHeight: 22 },
  form: {
    borderTopWidth: 0.5,
    borderTopColor: "#222",
    padding: 16,
    gap: 10,
  },
  input: {
    backgroundColor: "#1a1a1a",
    borderWidth: 0.5,
    borderColor: "#333",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#f0f0f0",
    fontSize: 15,
  },
  chipRow: { flexGrow: 0 },
  chip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: "#1a1a1a",
    borderWidth: 0.5,
    borderColor: "#333",
  },
  chipActive: { backgroundColor: "#534AB7", borderColor: "#534AB7" },
  chipText: { color: "#888", fontSize: 13 },
  chipTextActive: { color: "#EEEDFE" },
  timeRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  timeSep: { color: "#666", paddingBottom: 14 },
  addBtn: {
    backgroundColor: "#3d3580",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  addBtnText: { color: "#EEEDFE", fontSize: 15, fontWeight: "600" },
  primaryBtn: {
    marginHorizontal: 16,
    marginBottom: 32,
    backgroundColor: "#534AB7",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: { color: "#EEEDFE", fontSize: 16, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
});
