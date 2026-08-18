import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {},
}));

import { computeStreakData, STREAK_THRESHOLD, StatsRow } from "./stats";

function rowsForDay(date: string, statuses: string[]): StatsRow[] {
  return statuses.map((status) => ({ date, status }));
}

describe("computeStreakData", () => {
  const today = "2026-08-18"; // Tuesday
  const monday = "2026-08-17";

  it("counts a day at exactly 80% accounted toward the streak", () => {
    const rows = rowsForDay("2026-08-17", [
      "completed",
      "completed",
      "completed",
      "completed",
      "missed",
      "missed",
      "missed",
      "missed",
      "pending",
      "pending",
    ]);
    expect(8 / 10).toBe(STREAK_THRESHOLD);

    const { streak } = computeStreakData(rows, today, monday);
    expect(streak).toBe(1);
  });

  it("counts a fully missed but fully accounted day toward the streak", () => {
    const rows = rowsForDay("2026-08-17", ["missed", "missed", "missed", "missed", "missed"]);

    const { streak } = computeStreakData(rows, today, monday);
    expect(streak).toBe(1);
  });

  it("breaks the streak when unaccounted drops a day below threshold", () => {
    const rows = [
      ...rowsForDay("2026-08-17", ["completed", "completed", "completed", "completed", "missed"]),
      ...rowsForDay("2026-08-16", [
        "completed",
        "completed",
        "completed",
        "unaccounted",
        "unaccounted",
      ]),
    ];

    const { streak } = computeStreakData(rows, today, monday);
    expect(streak).toBe(1);
  });

  it("excludes removed and rescheduled from numerator and denominator", () => {
    const rows = rowsForDay("2026-08-17", [
      "completed",
      "completed",
      "removed",
      "removed",
      "rescheduled",
    ]);

    const { weekDayCompletionRatio } = computeStreakData(rows, today, monday);
    expect(weekDayCompletionRatio[0]).toBe(1);
  });

  it("treats a day with no rows as transparent to the streak", () => {
    const rows = rowsForDay("2026-08-16", ["completed", "completed", "completed", "completed"]);

    const { streak } = computeStreakData(rows, today, monday);
    expect(streak).toBe(1);
  });

  it("does not break the streak when today is below threshold", () => {
    const rows = [
      ...rowsForDay(today, ["completed", "pending", "pending", "pending", "pending"]),
      ...rowsForDay("2026-08-17", ["completed", "completed", "completed", "completed", "completed"]),
    ];

    const { streak, todayCountedInStreak } = computeStreakData(rows, today, monday);
    expect(streak).toBe(1);
    expect(todayCountedInStreak).toBe(false);
  });

  it("includes today in the streak when today is fully accounted", () => {
    const rows = [
      ...rowsForDay(today, ["completed", "missed", "missed", "missed", "missed"]),
      ...rowsForDay("2026-08-17", ["completed", "completed", "completed", "completed", "completed"]),
    ];

    const { streak, todayCountedInStreak } = computeStreakData(rows, today, monday);
    expect(streak).toBe(2);
    expect(todayCountedInStreak).toBe(true);
  });

  it("separates completion and missed ratios for a fully missed day", () => {
    const rows = rowsForDay("2026-08-17", ["missed", "missed", "missed", "missed", "missed"]);

    const { weekDayCompletionRatio, weekDayMissedRatio } = computeStreakData(
      rows,
      today,
      monday
    );

    expect(weekDayCompletionRatio[0]).toBe(0);
    expect(weekDayMissedRatio[0]).toBe(1);
  });

  it("does not count a day at 79% accounted toward the streak", () => {
    const belowThresholdToday = "2026-08-17";
    const weekMonday = "2026-08-11";
    const rows = [
      ...rowsForDay(belowThresholdToday, [
        "completed",
        "completed",
        "completed",
        "completed",
        "completed",
        "completed",
        "completed",
        "pending",
        "pending",
        "pending",
      ]),
      ...rowsForDay("2026-08-16", ["completed", "completed", "completed", "completed", "completed"]),
    ];
    expect(7 / 10).toBeLessThan(STREAK_THRESHOLD);

    const { streak, todayCountedInStreak } = computeStreakData(
      rows,
      belowThresholdToday,
      weekMonday
    );
    expect(streak).toBe(1);
    expect(todayCountedInStreak).toBe(false);
  });
});
