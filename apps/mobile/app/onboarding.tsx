import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/providers/AuthProvider";
import { useStore } from "../src/store";
import { RequireAuth } from "../src/components/RequireAuth";
import { handleError } from "../src/lib/errors";
import { colors, spacing, radii, typography } from "../src/theme";

type Option = { label: string; value: string | string[] };

const TONE_OPTIONS: Option[] = [
  { label: "Direct — tell me straight", value: "firm" },
  { label: "Gentle — I'm hard enough on myself", value: "gentle" },
  { label: "Just the data — no commentary", value: "data-driven" },
];

const ENERGY_OPTIONS: Option[] = [
  { label: "Morning", value: ["morning"] },
  { label: "Afternoon", value: ["afternoon"] },
  { label: "Evening", value: ["evening"] },
  { label: "It varies", value: ["varies"] },
];

const PATTERN_OPTIONS: Option[] = [
  { label: "I start strong and fade", value: "fader" },
  { label: "I plan perfectly and don't start", value: "planner" },
  { label: "I rebel against my own rules", value: "rebel" },
  { label: "I keep going once something clicks", value: "builder" },
];

const STEP_COUNT = 4;

function OptionRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.optionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function OnboardingContent() {
  const { session, refreshProfile } = useAuth();
  const { setPsychologyProfile } = useStore();
  const userId = session?.user.id;

  const [step, setStep] = useState(0);
  const [tone, setTone] = useState<string | null>(null);
  const [energy, setEnergy] = useState<string[] | null>(null);
  const [pattern, setPattern] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleStart = async () => {
    if (!userId || !tone || !energy || !pattern || saving) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("psychology_profiles")
        .upsert(
          {
            user_id: userId,
            accountability_tone: tone,
            peak_energy_times: energy,
            motivation_style: pattern,
            completed_at: new Date().toISOString(),
            onboarding_messages: [],
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (error) throw error;
      if (data) setPsychologyProfile(data);
      await refreshProfile();
      router.replace("/schedule-builder");
    } catch (err) {
      handleError(err, "finishOnboarding");
    } finally {
      setSaving(false);
    }
  };

  if (!session) return null;

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 0 ? (
          <>
            <Text style={styles.question}>
              When things slip, how should FlexMax talk to you?
            </Text>
            {TONE_OPTIONS.map((opt) => (
              <OptionRow
                key={opt.label}
                label={opt.label}
                selected={tone === opt.value}
                onPress={() => {
                  setTone(opt.value as string);
                  setStep(1);
                }}
              />
            ))}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.question}>When do you actually have energy?</Text>
            {ENERGY_OPTIONS.map((opt) => (
              <OptionRow
                key={opt.label}
                label={opt.label}
                selected={
                  energy !== null &&
                  JSON.stringify(energy) === JSON.stringify(opt.value)
                }
                onPress={() => {
                  setEnergy(opt.value as string[]);
                  setStep(2);
                }}
              />
            ))}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.question}>Which one is you?</Text>
            {PATTERN_OPTIONS.map((opt) => (
              <OptionRow
                key={opt.label}
                label={opt.label}
                selected={pattern === opt.value}
                onPress={() => {
                  setPattern(opt.value as string);
                  setStep(3);
                }}
              />
            ))}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.contractTitle}>FlexMax learns from what actually happens.</Text>
            <Text style={styles.contractBody}>
              The first days are just living your schedule and closing out your days. The
              patterns come from what you do, not what you say. Give it a week.
            </Text>
            <TouchableOpacity
              style={[styles.startBtn, saving && styles.startBtnDisabled]}
              onPress={handleStart}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.startBtnText}>Start</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default function OnboardingRoute() {
  return (
    <RequireAuth requireOnboarding={false}>
      <OnboardingContent />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 60,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  question: {
    color: colors.text,
    ...typography.title,
    marginBottom: spacing.xxl,
  },
  option: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  optionText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  contractTitle: {
    color: colors.text,
    ...typography.title,
    marginBottom: spacing.lg,
  },
  contractBody: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.xxxl,
  },
  startBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  startBtnDisabled: {
    backgroundColor: colors.primaryDisabled,
  },
  startBtnText: {
    color: colors.onPrimary,
    ...typography.bodyBold,
  },
});
