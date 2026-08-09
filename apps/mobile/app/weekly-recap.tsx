import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../src/lib/supabase";
import { getLocalDateString } from "../src/lib/time";
import { handleError } from "../src/lib/errors";
import { useAuth } from "../src/providers/AuthProvider";
import { RequireAuth } from "../src/components/RequireAuth";
import { BrandLoader } from "../src/components/BrandLoader";
import { DaySquare, daySquareStripStyles } from "../src/components/DaySquare";
import { BehavioralInsight } from "../src/types/database";
import { Colors, spacing, radii, iconSizes } from "../src/theme";
import { useTheme } from "../src/providers/ThemeProvider";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const ACCOUNTED = ["completed", "missed", "skipped"];
const EXCLUDED = ["removed", "rescheduled"];
const STREAK_THRESHOLD = 0.8;

type WeekInstance = { date: string; status: string };

type RecapInsight = {
  kind: BehavioralInsight["kind"];
  belief: string;
  evidence: string;
  suggestion: string | null;
};

function getLastCompletedWeek() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + diffToMonday);
  thisMonday.setHours(0, 0, 0, 0);

  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);

  const lastMonday = new Date(lastSunday);
  lastMonday.setDate(lastSunday.getDate() - 6);

  return {
    monday: lastMonday,
    sunday: lastSunday,
    mondayStr: getLocalDateString(lastMonday),
    sundayStr: getLocalDateString(lastSunday),
  };
}

function formatWeekRange(monday: Date, sunday: Date): string {
  const monMonth = MONTHS[monday.getMonth()];
  const sunMonth = MONTHS[sunday.getMonth()];
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monMonth} ${monday.getDate()} – ${sunday.getDate()}`;
  }
  return `${monMonth} ${monday.getDate()} – ${sunMonth} ${sunday.getDate()}`;
}

function computeWeekShape(instances: WeekInstance[], monday: Date) {
  const byDate = new Map<
    string,
    { relevant: number; accounted: number; completed: number; missed: number }
  >();

  for (const row of instances) {
    if (EXCLUDED.includes(row.status)) continue;
    const entry = byDate.get(row.date) ?? {
      relevant: 0,
      accounted: 0,
      completed: 0,
      missed: 0,
    };
    entry.relevant++;
    if (ACCOUNTED.includes(row.status)) entry.accounted++;
    if (row.status === "completed") entry.completed++;
    if (row.status === "missed") entry.missed++;
    byDate.set(row.date, entry);
  }

  const completionRatio: number[] = [];
  const missedRatio: number[] = [];
  let daysAccounted = 0;

  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dateStr = getLocalDateString(day);
    const entry = byDate.get(dateStr);
    if (!entry || entry.relevant === 0) {
      completionRatio.push(0);
      missedRatio.push(0);
    } else {
      completionRatio.push(entry.completed / entry.relevant);
      missedRatio.push(entry.missed / entry.relevant);
      if (entry.accounted / entry.relevant >= STREAK_THRESHOLD) {
        daysAccounted++;
      }
    }
  }

  const hasData = instances.some((row) => !EXCLUDED.includes(row.status));

  return { completionRatio, missedRatio, daysAccounted, hasData };
}

function WeeklyRecapScreenContent() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuth();
  const week = useMemo(() => getLastCompletedWeek(), []);
  const weekLabel = useMemo(
    () => formatWeekRange(week.monday, week.sunday),
    [week.monday, week.sunday]
  );

  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [completionRatio, setCompletionRatio] = useState<number[]>(
    Array(7).fill(0)
  );
  const [missedRatio, setMissedRatio] = useState<number[]>(Array(7).fill(0));
  const [daysAccounted, setDaysAccounted] = useState(0);
  const [insight, setInsight] = useState<RecapInsight | null>(null);

  const loadRecap = useCallback(async () => {
    if (!session?.user.id) return;

    setLoading(true);
    try {
      const [instancesResult, insightResult] = await Promise.all([
        supabase
          .from("daily_schedule_instances")
          .select("date, status")
          .eq("user_id", session.user.id)
          .gte("date", week.mondayStr)
          .lte("date", week.sundayStr),
        (
          supabase as typeof supabase & {
            from: (table: "behavioral_insights") => ReturnType<typeof supabase.from>;
          }
        )
          .from("behavioral_insights")
          .select("kind, belief, evidence, suggestion")
          .eq("superseded", false)
          .neq("kind", "strength")
          .order("rank")
          .limit(1)
          .maybeSingle() as {
          data: RecapInsight | null;
          error: Error | null;
        },
      ]);

      if (instancesResult.error) throw instancesResult.error;
      if (insightResult.error) throw insightResult.error;

      const shape = computeWeekShape(instancesResult.data ?? [], week.monday);
      setHasData(shape.hasData);
      setCompletionRatio(shape.completionRatio);
      setMissedRatio(shape.missedRatio);
      setDaysAccounted(shape.daysAccounted);
      setInsight(insightResult.data);
    } catch (err) {
      handleError(err, "loadWeeklyRecap");
    } finally {
      setLoading(false);
    }
  }, [session?.user.id, week.monday, week.mondayStr, week.sundayStr]);

  useEffect(() => {
    loadRecap();
  }, [loadRecap]);

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.centered}>
        <BrandLoader size={56} />
      </View>
    );
  }

  if (!hasData) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.close}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Close"
        >
          <Feather name="x" size={iconSizes.md} color={colors.textMuted} />
        </TouchableOpacity>
        <Text style={styles.empty}>Not enough from last week yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.close}
        onPress={() => router.back()}
        hitSlop={8}
        accessibilityLabel="Close"
      >
        <Feather name="x" size={iconSizes.md} color={colors.textMuted} />
      </TouchableOpacity>

      <Text style={styles.title}>Last week</Text>
      <Text style={styles.range}>{weekLabel}</Text>

      <View style={daySquareStripStyles.weekStrip}>
        {DAY_LETTERS.map((letter, i) => (
          <DaySquare
            key={i}
            letter={letter}
            completionRatio={completionRatio[i]}
            missedRatio={missedRatio[i]}
          />
        ))}
      </View>

      <Text style={styles.accounted}>
        {daysAccounted} of 7 days accounted for
      </Text>

      {insight ? (
        <>
          <View style={styles.sectionDivider} />
          <Text style={styles.insightLabel}>What I'm seeing</Text>
          <Text style={styles.belief}>{insight.belief}</Text>
          {insight.suggestion ? (
            <>
              <View style={styles.hairline} />
              <Text style={styles.suggestion}>{insight.suggestion}</Text>
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

export default function WeeklyRecapScreen() {
  return (
    <RequireAuth>
      <WeeklyRecapScreenContent />
    </RequireAuth>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
      paddingTop: 60,
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
      marginBottom: spacing.lg,
    },
    title: {
      color: c.text,
      fontSize: 22,
      fontWeight: "700",
      marginBottom: spacing.xs,
    },
    range: {
      color: c.textMuted,
      fontSize: 13,
      marginBottom: spacing.xxl,
    },
    accounted: {
      color: c.text,
      fontSize: 17,
      marginTop: spacing.xxl,
    },
    sectionDivider: {
      height: 0.5,
      backgroundColor: c.border,
      marginTop: spacing.xxxl,
      marginBottom: spacing.xxl,
    },
    insightLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    belief: {
      color: c.text,
      fontSize: 15,
      lineHeight: 22,
    },
    hairline: {
      height: 0.5,
      backgroundColor: c.border,
      marginVertical: spacing.lg,
    },
    suggestion: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    empty: {
      color: c.textMuted,
      fontSize: 15,
      textAlign: "center",
      marginTop: spacing.xxxl,
    },
  });
