import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/providers/AuthProvider";
import { useTheme, ThemeMode } from "../src/providers/ThemeProvider";
import { RequireAuth } from "../src/components/RequireAuth";
import { BrandMark } from "../src/components/BrandMark";
import { PressableScale } from "../src/components/PressableScale";
import { Colors, spacing, radii, typography } from "../src/theme";
import { getInitials } from "../src/lib/format";
import { handleError } from "../src/lib/errors";
import { hapticSelect } from "../src/lib/haptics";

const APPEARANCE_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

// These three values are the only ones weekly-insight is designed
// around, and they are written verbatim into the AI prompt. They are
// NOT enforced by a database constraint, so this list is the only thing
// keeping the column clean.
const TONE_OPTIONS: { label: string; caption: string; value: string }[] = [
  { label: "Direct", caption: "Says it plainly.", value: "firm" },
  { label: "Gentle", caption: "A lighter touch.", value: "gentle" },
  { label: "Just the numbers", caption: "No commentary.", value: "data-driven" },
];

function AccountScreenContent() {
  const { session, profile, psychologyProfile, signOut, refreshProfile } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [savingTone, setSavingTone] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);

  const initials = getInitials(profile?.name ?? "User");
  const currentTone = psychologyProfile?.accountability_tone ?? "firm";

  useEffect(() => {
    Notifications.getPermissionsAsync()
      .then(({ status }) => setNotifGranted(status === "granted"))
      .catch(() => setNotifGranted(null));
  }, []);

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
      handleError(err, "saveName", "Could not save");
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

  const handleToneChange = async (value: string) => {
    if (!session?.user.id || value === currentTone) return;
    hapticSelect();
    setSavingTone(true);
    try {
      // psychology_profiles has unique(user_id), so upsert covers users who
      // never went through the AI onboarding and have no row at all.
      const { error } = await supabase
        .from("psychology_profiles")
        .upsert(
          { user_id: session.user.id, accountability_tone: value },
          { onConflict: "user_id" }
        );
      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      handleError(err, "handleToneChange", "Couldn't save that preference");
    } finally {
      setSavingTone(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;

      await signOut();
      router.replace("/sign-in");
    } catch (err) {
      handleError(err, "deleteAccount", "Couldn't delete your account");
      setDeleting(false);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This permanently deletes your account, your schedule, and every reflection and completion record. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you sure?",
              "There is no way to recover this data.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete my account",
                  style: "destructive",
                  onPress: deleteAccount,
                },
              ]
            );
          },
        },
      ]
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How FlexMax talks to you</Text>
          <Text style={styles.sectionCaption}>
            Changes the voice of your weekly insights.
          </Text>
          {TONE_OPTIONS.map((option) => {
            const selected = currentTone === option.value;
            return (
              <PressableScale
                key={option.value}
                style={[styles.toneRow, selected && styles.toneRowSelected]}
                onPress={() => handleToneChange(option.value)}
                disabled={savingTone}
              >
                <View style={styles.toneTextWrap}>
                  <Text
                    style={[
                      styles.toneLabel,
                      selected && styles.toneLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.toneCaption}>{option.caption}</Text>
                </View>
                {selected ? <Text style={styles.toneCheck}>✓</Text> : null}
              </PressableScale>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Timezone</Text>
            <Text style={styles.settingValue}>{profile?.timezone ?? "America/Chicago"}</Text>
          </View>
          {notifGranted === false ? (
            <PressableScale
              style={styles.notifRow}
              onPress={() => Linking.openSettings()}
            >
              <Text style={styles.settingLabel}>Notifications</Text>
              <Text style={styles.notifOff}>Off — tap to enable</Text>
            </PressableScale>
          ) : notifGranted === true ? (
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Notifications</Text>
              <Text style={styles.settingValue}>On</Text>
            </View>
          ) : null}
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Appearance</Text>
          </View>
          <View style={styles.appearanceSegment}>
            {APPEARANCE_OPTIONS.map((option) => {
              const selected = mode === option.value;
              return (
                <PressableScale
                  key={option.value}
                  style={[styles.segment, selected && styles.segmentSelected]}
                  onPress={() => {
                    hapticSelect();
                    setMode(option.value);
                  }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      selected ? styles.segmentTextSelected : styles.segmentTextUnselected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <PressableScale style={styles.signOutBtn} onPress={confirmSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </PressableScale>

        <PressableScale
          style={styles.deleteBtn}
          onPress={confirmDeleteAccount}
          disabled={deleting}
        >
          <Text style={styles.deleteText}>
            {deleting ? "Deleting..." : "Delete account"}
          </Text>
        </PressableScale>

        <View style={styles.footerMark}>
          <BrandMark size={28} />
        </View>
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

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
    backLink: { color: c.primary, fontSize: 15 },
    scroll: { padding: spacing.xl, paddingBottom: 60, flexGrow: 1 },
    avatarSection: { alignItems: "center", marginBottom: spacing.xxxl },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: c.primaryDeep,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    avatarText: { color: c.primary, fontSize: 26, fontWeight: "600" },
    name: { color: c.text, ...typography.title, textAlign: "center" },
    editHint: { color: c.textPlaceholder, fontSize: 12, textAlign: "center", marginTop: spacing.xs },
    nameEditRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    nameInput: {
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: c.text,
      fontSize: 18,
      minWidth: 160,
    },
    nameSave: { color: c.primary, ...typography.bodyBold },
    section: { marginBottom: 28 },
    sectionTitle: {
      color: c.textMuted,
      ...typography.smallBold,
      marginBottom: 14,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    sectionCaption: {
      ...typography.caption,
      color: c.textSecondary,
      marginBottom: spacing.md,
    },
    toneRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      marginBottom: spacing.sm,
      backgroundColor: c.surfaceNested,
    },
    toneRowSelected: {
      backgroundColor: c.primaryTint,
    },
    toneTextWrap: {
      flex: 1,
    },
    toneLabel: {
      ...typography.body,
      color: c.text,
    },
    toneLabelSelected: {
      ...typography.body,
      color: c.text,
      fontWeight: "600",
    },
    toneCaption: {
      ...typography.caption,
      color: c.textSecondary,
    },
    toneCheck: {
      ...typography.body,
      color: c.primary,
    },
    notifRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: 0.5,
      borderBottomColor: c.surface,
    },
    notifOff: {
      ...typography.body,
      color: c.primary,
    },
    summaryCard: {
      backgroundColor: c.primaryTint,
      borderRadius: radii.lg,
      padding: 14,
      borderLeftWidth: 2,
      borderLeftColor: c.primary,
      marginBottom: spacing.lg,
    },
    summaryText: { color: c.textSecondary, fontSize: 14, lineHeight: 22 },
    profileBlock: { marginBottom: spacing.lg },
    profileLabel: {
      color: c.textFaint,
      fontSize: 12,
      fontWeight: "600",
      marginBottom: spacing.sm,
      textTransform: "uppercase",
    },
    profileValue: { color: c.textSecondary, fontSize: 15, textTransform: "capitalize" },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
      backgroundColor: c.surface,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    chipText: { color: c.textSecondary, fontSize: 13 },
    redoBtn: {
      marginTop: spacing.sm,
      borderRadius: radii.md,
      borderWidth: 0.5,
      borderColor: c.primary,
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    redoBtnText: { color: c.primary, fontSize: 14, fontWeight: "600" },
    emptyProfile: { color: c.textFaint, fontSize: 14, lineHeight: 22 },
    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: 0.5,
      borderBottomColor: c.surface,
    },
    settingLabel: { color: c.textSecondary, fontSize: 15 },
    settingValue: { color: c.textFaint, fontSize: 15 },
    appearanceSegment: {
      flexDirection: "row",
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceNested,
      padding: spacing.sm,
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    segment: {
      flex: 1,
      borderRadius: radii.sm,
      paddingVertical: spacing.sm,
      alignItems: "center",
    },
    segmentSelected: {
      backgroundColor: c.primary,
    },
    segmentText: {
      ...typography.smallBold,
    },
    segmentTextSelected: {
      color: c.onPrimary,
    },
    segmentTextUnselected: {
      color: c.textMuted,
    },
    signOutBtn: {
      marginTop: spacing.md,
      backgroundColor: c.surface,
      borderRadius: radii.lg,
      paddingVertical: spacing.lg,
      alignItems: "center",
    },
    signOutText: { color: c.danger, ...typography.bodyBold },
    deleteBtn: {
      marginTop: spacing.sm,
      paddingVertical: spacing.lg,
      alignItems: "center",
    },
    deleteText: { color: c.danger, ...typography.small },
    footerMark: { marginTop: spacing.xxxl, opacity: 0.4, alignItems: "center" },
  });
