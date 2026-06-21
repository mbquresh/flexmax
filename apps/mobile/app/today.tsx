import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { generateDailyInstances, supabase } from "../src/lib/supabase";
import { useAuth } from "../src/providers/AuthProvider";
import { useStore } from "../src/store";
import { DailyInstance } from "../src/types/database";
import { minutesToTime } from "@flexmax/ai";

export default function TodayScreen() {
  const { session, signOut } = useAuth();
  const { todayInstances, setTodayInstances } = useStore();
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!session?.user.id) return;

    const loadToday = async () => {
      await generateDailyInstances(today);

      const { data, error } = await supabase
        .from("daily_schedule_instances")
        .select("*, block:schedule_blocks(*)")
        .eq("user_id", session.user.id)
        .eq("date", today)
        .order("start_minutes");

      if (error) {
        console.error(error);
      } else {
        setTodayInstances(data ?? []);
      }
      setLoading(false);
    };

    loadToday();
  }, [session?.user.id, today]);

  const renderInstance = ({ item }: { item: DailyInstance }) => (
    <View style={styles.card}>
      <Text style={styles.blockName}>{item.block?.name ?? "Block"}</Text>
      <Text style={styles.meta}>
        {minutesToTime(item.start_minutes)} – {minutesToTime(item.end_minutes)} ·{" "}
        {item.status}
      </Text>
      {item.task_detail ? (
        <Text style={styles.task}>{item.task_detail}</Text>
      ) : (
        <Text style={styles.taskEmpty}>No task detail yet</Text>
      )}
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
        <Text style={styles.title}>Today</Text>
        <Text style={styles.date}>{today}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push("/schedule-builder")}>
            <Text style={styles.link}>Edit schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => signOut()}>
            <Text style={styles.link}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={todayInstances}
        keyExtractor={(item) => item.id}
        renderItem={renderInstance}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No blocks scheduled for today. Add blocks in the schedule builder.
          </Text>
        }
      />
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
  title: { fontSize: 28, fontWeight: "700", color: "#f0f0f0" },
  date: { fontSize: 14, color: "#888", marginTop: 4 },
  headerActions: { flexDirection: "row", gap: 16, marginTop: 12 },
  link: { color: "#534AB7", fontSize: 14 },
  list: { padding: 16, flexGrow: 1 },
  card: {
    backgroundColor: "#1e1e28",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  blockName: { color: "#f0f0f0", fontSize: 16, fontWeight: "600" },
  meta: { color: "#888", fontSize: 13, marginTop: 4 },
  task: { color: "#d0d0d0", fontSize: 14, marginTop: 8 },
  taskEmpty: { color: "#555", fontSize: 14, marginTop: 8, fontStyle: "italic" },
  empty: { color: "#666", textAlign: "center", marginTop: 40, lineHeight: 22 },
});
