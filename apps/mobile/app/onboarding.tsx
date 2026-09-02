import React, { useMemo, useState } from "react";
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
import { useTheme } from "../src/providers/ThemeProvider";
import { useStore } from "../src/store";
import { RequireAuth } from "../src/components/RequireAuth";
import { BrandMark } from "../src/components/BrandMark";
import { PressableScale } from "../src/components/PressableScale";
import { WeekDemo } from "../src/components/WeekDemo";
import { handleError } from "../src/lib/errors";
import { Colors, spacing, radii, typography } from "../src/theme";

type Option = { label: string; value: string | string[] };

const TONE_OPTIONS: Option[] = [
  { label: "Direct — tell me straight", value: "firm" },
  { label: "Gentle — I'm hard enough on myself", value: "gentle" },
  { label: "Just the data — no commentary", value: "data-driven" },
];

const TONE_LINES: Record<string, string> = {
  firm: "Direct feedback.",
  gentle: "A lighter touch.",
  "data-driven": "Numbers, no commentary.",
};

const STEP_COUNT = 5;

function OptionRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session, refreshProfile } = useAuth();
  const { setPsychologyProfile } = useStore();
  const userId = session?.user.id;

  const [step, setStep] = useState(0);
  const [tone, setTone] = useState<string | null>(null);
  const [filterUsed, setFilterUsed] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleStart = async () => {
    if (!userId || !tone || saving) {
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("psychology_profiles")
        .upsert(
          {
            user_id: userId,
            accountability_tone: tone,
            completed_at: new Date().toISOString(),
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
      handleError(err, "finishOnboarding", "Couldn't finish setting up your schedule");
    } finally {
      setSaving(false);
    }
  };

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
            <Text style={styles.question}>You already know what you should be doing.</Text>
            <Text style={styles.body}>
              That was never the problem. The problem is that the reason it
              doesn't happen is spread across the week, and you only ever live
              one day at a time.
            </Text>
            <PressableScale style={styles.actionBtn} onPress={() => setStep(1)}>
              <Text style={styles.actionBtnText}>Go on</Text>
            </PressableScale>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.question}>One month of someone's schedule.</Text>
            <Text style={styles.body}>
              Eight blocks, thirty days. Their gym sessions fail about 40% of
              the time and they've been calling it a motivation problem.
            </Text>
            <WeekDemo onFiltered={() => setFilterUsed(true)} />
            {filterUsed ? (
              <PressableScale style={styles.actionBtn} onPress={() => setStep(2)}>
                <Text style={styles.actionBtnText}>So what happened?</Text>
              </PressableScale>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.question}>90% versus 15%.</Text>
            <Text style={styles.body}>
              On the ten days their morning block ran past its window, the gym
              failed nine times. On the other twenty, it failed three.
            </Text>
            <Text style={styles.quote}>
              These two move together. When the morning runs long, the gym is
              what gets spent.
            </Text>
            <Text style={styles.body}>
              Same block, same person, two completely different outcomes —
              split by something that happened eight hours earlier and four
              blocks upstream. You'd have to notice a Tuesday morning to
              explain a Thursday evening.
            </Text>
            <PressableScale style={styles.actionBtn} onPress={() => setStep(3)}>
              <Text style={styles.actionBtnText}>How does it find that?</Text>
            </PressableScale>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.contractTitle}>It reads your days, not your answers.</Text>
            <Text style={styles.contractBody}>
              FlexMax checks every pair of blocks against every condition it can
              see, every week. That example took a month of real days. Yours
              will take about a week before it says anything worth reading —
              quiet at first, on purpose. You just live your schedule and close
              out your evenings.
            </Text>
            <PressableScale style={styles.actionBtn} onPress={() => setStep(4)}>
              <Text style={styles.actionBtnText}>Got it</Text>
            </PressableScale>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Text style={styles.question}>
              When things slip, how should FlexMax talk to you?
            </Text>
            {TONE_OPTIONS.map((opt) => (
              <OptionRow
                key={opt.label}
                label={opt.label}
                selected={tone === opt.value}
                onPress={() => setTone(opt.value as string)}
              />
            ))}
            {tone ? (
              <PressableScale
                style={styles.actionBtn}
                onPress={handleStart}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.actionBtnText}>Build my schedule</Text>
                )}
              </PressableScale>
            ) : null}
            <View style={styles.footerMark}>
              <BrandMark size={28} />
            </View>
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

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
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
      color: c.textMuted,
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
      backgroundColor: c.border,
    },
    dotActive: {
      backgroundColor: c.primary,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    question: {
      color: c.text,
      ...typography.title,
      marginBottom: spacing.xxl,
    },
    body: {
      color: c.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: spacing.xxl,
    },
    quote: {
      ...typography.body,
      color: c.textSecondary,
      marginBottom: spacing.xxl,
    },
    option: {
      backgroundColor: c.surface,
      borderRadius: radii.lg,
      padding: spacing.xl,
      borderWidth: 0.5,
      borderColor: c.border,
      marginBottom: spacing.md,
    },
    optionSelected: {
      borderColor: c.primary,
      backgroundColor: c.primaryTint,
    },
    optionText: {
      color: c.text,
      fontSize: 15,
      lineHeight: 22,
    },
    contractTitle: {
      color: c.text,
      ...typography.title,
      marginBottom: spacing.lg,
    },
    contractBody: {
      color: c.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: spacing.xxxl,
    },
    actionBtn: {
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.lg,
      alignItems: "center",
      marginTop: spacing.lg,
    },
    actionBtnText: {
      color: c.onPrimary,
      ...typography.bodyBold,
    },
    footerMark: { marginTop: spacing.xxxl, opacity: 0.4, alignItems: "center" },
  });
