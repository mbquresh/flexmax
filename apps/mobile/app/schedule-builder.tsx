import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/providers/AuthProvider";
import { useStore } from "../src/store";
import { ScheduleBlock } from "../src/types/database";
import { minutesToTime } from "@flexmax/ai";

export default function ScheduleBuilderScreen() {
  const { session } = useAuth();
  const { blocks, setBlocks } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user.id) return;

    const loadBlocks = async () => {
      const { data, error } = await supabase
        .from("schedule_blocks")
        .select("*")
        .eq("user_id", session.user.id)
        .order("start_minutes");

      if (error) {
        console.error(error);
      } else {
        setBlocks(data ?? []);
      }
      setLoading(false);
    };

    loadBlocks();
  }, [session?.user.id]);

  const renderBlock = ({ item }: { item: ScheduleBlock }) => (
    <View style={styles.blockCard}>
      <Text style={styles.blockName}>{item.name}</Text>
      <Text style={styles.blockMeta}>
        {minutesToTime(item.start_minutes)} – {minutesToTime(item.end_minutes)} ·{" "}
        {item.category}
      </Text>
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
          Add time blocks for your week. Drag-and-shift comes next.
        </Text>
      </View>

      <FlatList
        data={blocks}
        keyExtractor={(item) => item.id}
        renderItem={renderBlock}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No blocks yet. Use Supabase or the upcoming block editor to add your first block.
          </Text>
        }
      />

      <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace("/today")}>
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
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: "600", color: "#f0f0f0" },
  subtitle: { fontSize: 14, color: "#888", marginTop: 6 },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  blockCard: {
    backgroundColor: "#1e1e28",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  blockName: { color: "#f0f0f0", fontSize: 16, fontWeight: "600" },
  blockMeta: { color: "#888", fontSize: 13, marginTop: 4 },
  empty: { color: "#666", textAlign: "center", marginTop: 40, lineHeight: 22 },
  primaryBtn: {
    margin: 20,
    marginBottom: 40,
    backgroundColor: "#534AB7",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: { color: "#EEEDFE", fontSize: 16, fontWeight: "600" },
});
