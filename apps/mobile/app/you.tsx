import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../src/lib/supabase";
import { getLocalDateString } from "../src/lib/time";
import { handleError, isConnectivityError } from "../src/lib/errors";
import { track } from "../src/lib/analytics";
import { hapticSelect } from "../src/lib/haptics";
import { useAuth } from "../src/providers/AuthProvider";
import { RequireAuth } from "../src/components/RequireAuth";
import { BrandLoader } from "../src/components/BrandLoader";
import { LoadError } from "../src/components/LoadError";
import { WeekSeriesChart } from "../src/components/WeekSeriesChart";
import { DisputeSheet } from "../src/components/DisputeSheet";
import { PressableScale } from "../src/components/PressableScale";
import { BehavioralInsight } from "../src/types/database";
import { visibleTheoryLines } from "../src/lib/theory";
import {
  HISTORY_WEEKS,
  addDays,
  computeHistoryFacts,
  computeWeekSeries,
  mondayOf,
  HistoryFacts,
  WeekBar,
} from "../src/lib/stats";
import { Colors, spacing, radii, iconSizes, typography, numeric } from "../src/theme";
import { useTheme } from "../src/providers/ThemeProvider";

type TheoryInsight = Pick<
  BehavioralInsight,
  "id" | "kind" | "belief" | "suggestion" | "rank"
> & { disputed_at: string | null };

function YouScreenContent() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const todayStr = useMemo(() => getLocalDateString(), []);
  const thisMonday = useMemo(() => mondayOf(todayStr), [todayStr]);
  const fromMonday = useMemo(
    () => addDays(thisMonday, -(HISTORY_WEEKS - 1) * 7),
    [thisMonday]
  );
  const factsFrom = useMemo(() => addDays(todayStr, -29), [todayStr]);

  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadOffline, setLoadOffline] = useState(false);
  const [weeks, setWeeks] = useState<WeekBar[]>([]);
  const [facts, setFacts] = useState<HistoryFacts | null>(null);
  const [insights, setInsights] = useState<TheoryInsight[]>([]);
  const [disputing, setDisputing] = useState<TheoryInsight | null>(null);
  const [saving, setSaving] = useState(false);

  const lines = useMemo(() => visibleTheoryLines(insights), [insights]);

  const load = useCallback(async () => {
    if (!session?.user.id) return;

    setLoading(true);
    setLoadFailed(false);
    try {
      const [instancesResult, insightResult] = await Promise.all([
        supabase
          .from("daily_schedule_instances")
          .select("date, status")
          .eq("user_id", session.user.id)
          .gte("date", fromMonday)
          .lte("date", addDays(thisMonday, 6)),
        supabase
          .from("behavioral_insights")
          .select("id, kind, belief, suggestion, rank, disputed_at")
          .eq("superseded", false)
          .order("rank"),
      ]);

      if (instancesResult.error) throw instancesResult.error;
      if (insightResult.error) throw insightResult.error;

      const rows = instancesResult.data ?? [];
      setWeeks(computeWeekSeries(rows, fromMonday, thisMonday, todayStr));
      setFacts(computeHistoryFacts(rows, factsFrom, todayStr));
      setInsights((insightResult.data ?? []) as TheoryInsight[]);
    } catch (err) {
      setLoadFailed(true);
      setLoadOffline(isConnectivityError(err));
      handleError(err, "loadYou");
    } finally {
      setLoading(false);
    }
  }, [session?.user.id, fromMonday, thisMonday, todayStr, factsFrom]);

  useEffect(() => {
    load();
  }, [load]);

  const submitDispute = async (note: string) => {
    if (!disputing || saving) return;
    const target = disputing;
    setSaving(true);
    setInsights((prev) =>
      prev.map((row) =>
        row.id === target.id
          ? { ...row, disputed_at: new Date().toISOString() }
          : row
      )
    );
    setDisputing(null);
    try {
      const { error } = await supabase.rpc("dispute_insight", {
        p_insight_id: target.id,
        p_note: note,
      });
      if (error) throw error;
      track("insight_disputed", { kind: target.kind });
    } catch (err) {
      setInsights((prev) =>
        prev.map((row) =>
          row.id === target.id ? { ...row, disputed_at: null } : row
        )
      );
      handleError(err, "disputeInsight", "Couldn't save that correction");
    } finally {
      setSaving(false);
    }
  };

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.centered}>
        <BrandLoader size={56} />
      </View>
    );
  }

  if (loadFailed) {
    return (
      <View style={styles.centered}>
        <LoadError offline={loadOffline} onRetry={load} />
      </View>
    );
  }

  const hasChart = weeks.some((w) => w.hasData);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <TouchableOpacity
        style={styles.close}
        onPress={() => router.back()}
        hitSlop={8}
        accessibilityLabel="Close"
      >
        <Feather name="x" size={iconSizes.md} color={colors.textMuted} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Theory of You</Text>

        {hasChart ? (
          <View style={styles.chartBlock}>
            <WeekSeriesChart weeks={weeks} currentMonday={thisMonday} />
            {facts && facts.daysWithBlocks > 0 ? (
              <Text style={styles.fact}>
                {facts.daysAccounted} of {facts.daysWithBlocks} days accounted
                {"  ·  "}
                {facts.landed} of {facts.relevant} landed
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.empty}>Nothing to plot yet.</Text>
        )}

        {lines.length > 0 ? (
          <View style={styles.theory}>
            <Text style={styles.theoryHint}>Tap to dispute</Text>
            {lines.map((line) => (
              <PressableScale
                key={line.id}
                variant="highlight"
                baseColor={colors.background}
                highlightColor={colors.surfaceNested}
                style={styles.line}
                accessibilityRole="button"
                accessibilityLabel={`Correct: ${line.belief}`}
                onPress={() => {
                  hapticSelect();
                  setDisputing(line);
                }}
              >
                <View style={styles.lineBody}>
                  <Text style={styles.belief}>{line.belief}</Text>
                  {line.suggestion ? (
                    <Text style={styles.suggestion}>{line.suggestion}</Text>
                  ) : null}
                </View>
                <Feather
                  name="edit-2"
                  size={iconSizes.sm}
                  color={colors.textFaint}
                />
              </PressableScale>
            ))}
          </View>
        ) : insights.every((row) => !row.disputed_at) ? (
          <Text style={styles.emptyTheory}>
            I&apos;ll have something to say after a week of closed days.
          </Text>
        ) : null}
      </ScrollView>

      <DisputeSheet
        belief={disputing?.belief ?? null}
        visible={!!disputing}
        saving={saving}
        onSubmit={submitDispute}
        onClose={() => {
          if (!saving) setDisputing(null);
        }}
      />
    </View>
  );
}

export default function YouScreen() {
  return (
    <RequireAuth>
      <YouScreenContent />
    </RequireAuth>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
      paddingHorizontal: spacing.xl,
    },
    centered: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: "center",
      justifyContent: "center",
    },
    close: {
      alignSelf: "flex-end",
      marginBottom: spacing.sm,
    },
    scroll: {
      flexGrow: 1,
    },
    title: {
      color: c.text,
      ...typography.display,
      marginBottom: spacing.xxxl,
    },
    chartBlock: {
      marginBottom: spacing.xxxl,
    },
    fact: {
      color: c.textFaint,
      ...typography.caption,
      ...numeric,
      marginTop: spacing.md,
    },
    empty: {
      color: c.textMuted,
      ...typography.body,
      marginBottom: spacing.xxxl,
    },
    theory: {
      gap: spacing.xs,
    },
    theoryHint: {
      color: c.textFaint,
      ...typography.caption,
      marginBottom: spacing.sm,
    },
    line: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      paddingVertical: spacing.lg,
      marginHorizontal: -spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.md,
    },
    lineBody: {
      flex: 1,
    },
    belief: {
      color: c.text,
      fontSize: 17,
      fontWeight: "400",
      letterSpacing: -0.2,
      lineHeight: 24,
    },
    suggestion: {
      color: c.textMuted,
      ...typography.smallRelaxed,
      marginTop: spacing.sm,
    },
    emptyTheory: {
      color: c.textMuted,
      ...typography.body,
    },
  });
