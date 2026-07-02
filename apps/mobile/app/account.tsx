import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/providers/AuthProvider";
import { RequireAuth } from "../src/components/RequireAuth";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function AccountScreenContent() {
  const { session, profile, psychologyProfile, signOut, refreshProfile } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile?.name ?? "");
  const [saving, setSaving] = useState(false);

  const initials = getInitials(profile?.name ?? "User");

  const saveName = async () => {
    if (!nameDraft.trim() || !session) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name: nameDraft.trim() })
        .eq("id", session.user.id);
      if (error) throw error;
      await refreshProfile();
      setEditingName(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save";
      if (Platform.OS !== "web") Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  };

  const confirmSignOut = () => {
    if (Platform.OS === "web") {
      signOut().then(() => router.replace("/sign-in"));
      return;
    }
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/sign-in");
        },
      },
    ]);
  };

  const confirmRedoOnboarding = () => {
    Alert.alert(
      "Redo onboarding",
      "This will start a fresh onboarding conversation. Your current psychology profile will be replaced. Your schedule stays intact.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Redo",
          onPress: () => router.push("/onboarding"),
        },
      ]
    );
  };

  const renderChips = (label: string, items: string[] | null) => {
    if (!items?.length) return null;
    return (
      <View style={styles.profileBlock}>
        <Text style={styles.profileLabel}>{label}</Text>
        <View style={styles.chipWrap}>
          {items.map((item, i) => (
            <View key={i} style={styles.chip}>
              <Text style={styles.chipText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.backLink}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={nameDraft}
                onChangeText={setNameDraft}
                autoFocus
                onSubmitEditing={saveName}
              />
              <TouchableOpacity onPress={saveName} disabled={saving}>
                <Text style={styles.nameSave}>{saving ? "..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                setNameDraft(profile?.name ?? "");
                setEditingName(true);
              }}
            >
              <Text style={styles.name}>{profile?.name ?? "User"}</Text>
              <Text style={styles.editHint}>Tap to edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {psychologyProfile?.completed_at ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What FlexMax learned about you</Text>

            {psychologyProfile.raw_ai_summary ? (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryText}>{psychologyProfile.raw_ai_summary}</Text>
              </View>
            ) : null}

            {renderChips("Peak energy", psychologyProfile.peak_energy_times)}
            {renderChips("Goals", psychologyProfile.goals)}
            {renderChips("Sabotage patterns", psychologyProfile.sabotage_triggers)}
            {renderChips("Avoidance patterns", psychologyProfile.avoidance_patterns)}

            {psychologyProfile.motivation_style ? (
              <View style={styles.profileBlock}>
                <Text style={styles.profileLabel}>Motivation style</Text>
                <Text style={styles.profileValue}>{psychologyProfile.motivation_style}</Text>
              </View>
            ) : null}

            {psychologyProfile.accountability_tone ? (
              <View style={styles.profileBlock}>
                <Text style={styles.profileLabel}>Accountability style</Text>
                <Text style={styles.profileValue}>{psychologyProfile.accountability_tone}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.redoBtn} onPress={confirmRedoOnboarding}>
              <Text style={styles.redoBtnText}>Redo onboarding</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.emptyProfile}>
              Complete onboarding to see your psychology profile.
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Timezone</Text>
            <Text style={styles.settingValue}>{profile?.timezone ?? "America/Chicago"}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={confirmSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export default function AccountScreen() {
  return (
    <RequireAuth>
      <AccountScreenContent />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#DCDCDC" },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 8 },
  backLink: { color: "#3B6EA5", fontSize: 15 },
  scroll: { padding: 20, paddingBottom: 60, flexGrow: 1 },
  avatarSection: { alignItems: "center", marginBottom: 32 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#2C4A6E",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { color: "#3B6EA5", fontSize: 26, fontWeight: "600" },
  name: { color: "#1E1E1E", fontSize: 22, fontWeight: "600", textAlign: "center" },
  editHint: { color: "#999999", fontSize: 12, textAlign: "center", marginTop: 4 },
  nameEditRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  nameInput: {
    backgroundColor: "#EDEDED",
    borderWidth: 0.5,
    borderColor: "#C4C4C4",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#1E1E1E",
    fontSize: 18,
    minWidth: 160,
  },
  nameSave: { color: "#3B6EA5", fontSize: 15, fontWeight: "600" },
  section: { marginBottom: 28 },
  sectionTitle: {
    color: "#666666",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryCard: {
    backgroundColor: "#DCE6F2",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 2,
    borderLeftColor: "#3B6EA5",
    marginBottom: 16,
  },
  summaryText: { color: "#333333", fontSize: 14, lineHeight: 22 },
  profileBlock: { marginBottom: 16 },
  profileLabel: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  profileValue: { color: "#333333", fontSize: 15, textTransform: "capitalize" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#EDEDED",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 0.5,
    borderColor: "#C4C4C4",
  },
  chipText: { color: "#333333", fontSize: 13 },
  redoBtn: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "#3B6EA5",
    paddingVertical: 12,
    alignItems: "center",
  },
  redoBtnText: { color: "#3B6EA5", fontSize: 14, fontWeight: "600" },
  emptyProfile: { color: "#888888", fontSize: 14, lineHeight: 22 },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#EDEDED",
  },
  settingLabel: { color: "#333333", fontSize: 15 },
  settingValue: { color: "#888888", fontSize: 15 },
  signOutBtn: {
    marginTop: 12,
    backgroundColor: "#EDEDED",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  signOutText: { color: "#D9694A", fontSize: 15, fontWeight: "600" },
});
