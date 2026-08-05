import React, { useEffect, useRef, useState } from "react";
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

const PLANNERS_OPTIONS: Option[] = [
  { label: "One or two", value: "few" },
  { label: "Three to five", value: "several" },
  { label: "I've lost count", value: "lost_count" },
];

const FAILURE_OPTIONS: Option[] = [
  { label: "The app made me feel worse", value: "shame" },
  { label: "Life broke the plan and it couldn't adapt", value: "rigidity" },
  { label: "I just stopped opening it", value: "faded" },
];

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

const TONE_LINES: Record<string, string> = {
  firm: "Direct feedback.",
  gentle: "A lighter touch.",
  "data-driven": "Numbers, no commentary.",
};

const ENERGY_LINES: Record<string, string> = {
  morning: "Morning energy.",
  afternoon: "Afternoon energy.",
  evening: "Evening energy.",
  varies: "Energy that moves around.",
};

const PATTERN_LINES: Record<string, string> = {
  fader: "Starts strong, fades.",
  planner: "Plans everything, starts nothing.",
  rebel: "Fights own rules.",
  builder: "Keeps going once it clicks.",
};

const STEP_COUNT = 7;
const ADVANCE_MS = 250;

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
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [step, setStep] = useState(0);
  const [plannersAbandoned, setPlannersAbandoned] = useState<string | null>(null);
  const [pastFailureMode, setPastFailureMode] = useState<string | null>(null);
  const [tone, setTone] = useState<string | null>(null);
  const [energy, setEnergy] = useState<string[] | null>(null);
  const [pattern, setPattern] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  const advanceAfter = (nextStep: number) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => setStep(nextStep), ADVANCE_MS);
  };

  const handleStart = async () => {
    if (
      !userId ||
      !plannersAbandoned ||
      !pastFailureMode ||
      !tone ||
      !energy ||
      !pattern ||
      saving
    ) {
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("psychology_profiles")
        .upsert(
          {
            user_id: userId,
            planners_abandoned: plannersAbandoned,
            past_failure_mode: pastFailureMode,
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

  const toneLine = tone ? TONE_LINES[tone] : null;
  const energyLine = energy?.[0] ? ENERGY_LINES[energy[0]] : null;
  const patternLine = pattern ? PATTERN_LINES[pattern] : null;

  if (!session) return null;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        {step > 0 ? (
          <TouchableOpacity
            style={styles.back}
            onPress={() => setStep(step - 1)}
            hitSlop={8}
            accessibilityLabel="Back"
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <View style={styles.dots}>
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <View style={styles.backPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 0 ? (
          <>
            <Text style={styles.question}>How many planners have you abandoned?</Text>
            {PLANNERS_OPTIONS.map((opt) => (
              <OptionRow
                key={opt.label}
                label={opt.label}
                selected={plannersAbandoned === opt.value}
                onPress={() => {
                  setPlannersAbandoned(opt.value as string);
                  advanceAfter(1);
                }}
              />
            ))}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.question}>What usually kills it?</Text>
            {FAILURE_OPTIONS.map((opt) => (
              <OptionRow
                key={opt.label}
                label={opt.label}
                selected={pastFailureMode === opt.value}
                onPress={() => {
                  setPastFailureMode(opt.value as string);
                  advanceAfter(2);
                }}
              />
            ))}
          </>
        ) : null}

        {step === 2 ? (
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
                  advanceAfter(3);
                }}
              />
            ))}
          </>
        ) : null}

        {step === 3 ? (
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
                  advanceAfter(4);
                }}
              />
            ))}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Text style={styles.question}>Which one is you?</Text>
            {PATTERN_OPTIONS.map((opt) => (
              <OptionRow
                key={opt.label}
                label={opt.label}
                selected={pattern === opt.value}
                onPress={() => {
                  setPattern(opt.value as string);
                  advanceAfter(5);
                }}
              />
            ))}
          </>
        ) : null}

        {step === 5 && toneLine && energyLine && patternLine ? (
          <>
            <Text style={styles.payoffTitle}>Here's what we're working with.</Text>
            <Text style={styles.payoffLine}>{toneLine}</Text>
            <Text style={styles.payoffLine}>{energyLine}</Text>
            <Text style={styles.payoffLine}>{patternLine}</Text>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setStep(6)}
            >
              <Text style={styles.actionBtnText}>Continue</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {step === 6 ? (
          <>
            <Text style={styles.contractTitle}>FlexMax learns from what actually happens.</Text>
            <Text style={styles.contractBody}>
              The first days are just living your schedule and closing out your days. The
              patterns come from what you do, not what you say. Give it a week.
            </Text>
            <TouchableOpacity
              style={[styles.actionBtn, saving && styles.actionBtnDisabled]}
              onPress={handleStart}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.actionBtnText}>Start</Text>
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  back: {
    width: 32,
  },
  backPlaceholder: {
    width: 32,
  },
  backText: {
    color: colors.textMuted,
    fontSize: 28,
    lineHeight: 28,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
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
  payoffTitle: {
    color: colors.text,
    ...typography.title,
    marginBottom: spacing.xxl,
  },
  payoffLine: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 26,
    marginBottom: spacing.md,
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
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  actionBtnDisabled: {
    backgroundColor: colors.primaryDisabled,
  },
  actionBtnText: {
    color: colors.onPrimary,
    ...typography.bodyBold,
  },
});
