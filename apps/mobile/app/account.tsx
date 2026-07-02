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
import { colors, spacing, radii, typography } from "../src/theme";

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
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  backLink: { color: colors.primary, fontSize: 15 },
  scroll: { padding: spacing.xl, paddingBottom: 60, flexGrow: 1 },
  avatarSection: { alignItems: "center", marginBottom: spacing.xxxl },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryDeep,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarText: { color: colors.primary, fontSize: 26, fontWeight: "600" },
  name: { color: colors.text, ...typography.title, textAlign: "center" },
  editHint: { color: colors.textPlaceholder, fontSize: 12, textAlign: "center", marginTop: spacing.xs },
  nameEditRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  nameInput: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 18,
    minWidth: 160,
  },
  nameSave: { color: colors.primary, ...typography.bodyBold },
  section: { marginBottom: 28 },
  sectionTitle: {
    color: colors.textMuted,
    ...typography.smallBold,
    marginBottom: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryCard: {
    backgroundColor: colors.primaryTint,
    borderRadius: radii.lg,
    padding: 14,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    marginBottom: spacing.lg,
  },
  summaryText: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  profileBlock: { marginBottom: spacing.lg },
  profileLabel: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  profileValue: { color: colors.textSecondary, fontSize: 15, textTransform: "capitalize" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  chipText: { color: colors.textSecondary, fontSize: 13 },
  redoBtn: {
    marginTop: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 0.5,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  redoBtnText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  emptyProfile: { color: colors.textFaint, fontSize: 14, lineHeight: 22 },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.surface,
  },
  settingLabel: { color: colors.textSecondary, fontSize: 15 },
  settingValue: { color: colors.textFaint, fontSize: 15 },
  signOutBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  signOutText: { color: colors.danger, ...typography.bodyBold },
});
