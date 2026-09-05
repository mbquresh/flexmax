import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {},
}));

import {
  computeStreakData,
  computeWeekView,
  addDays,
  daysBetween,
  isWithinEditWindow,
  mondayOf,
  mondaysThrough,
  weekDates,
  EDIT_WINDOW_DAYS,
  STREAK_THRESHOLD,
  StatsRow,
} from "./stats";

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

describe("week date helpers", () => {
  it("resolves Monday from any day of that week", () => {
    // 2026-08-17 is a Monday, 2026-08-23 the Sunday that closes it.
    expect(mondayOf("2026-08-17")).toBe("2026-08-17");
    expect(mondayOf("2026-08-20")).toBe("2026-08-17");
    expect(mondayOf("2026-08-23")).toBe("2026-08-17");
  });

  it("treats Sunday as the end of the week, not the start", () => {
    expect(mondayOf("2026-08-23")).not.toBe("2026-08-24");
  });

  it("crosses month and year boundaries", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-08-17", -7)).toBe("2026-08-10");
  });

  it("counts days across a DST boundary", () => {
    // US DST ends 2026-11-01. A naive millisecond division rounds to 0.96
    // of a day here, which would floor to the wrong answer.
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
  });

  it("lists Mondays from the first week through the last", () => {
    expect(mondaysThrough("2026-08-17", "2026-08-31")).toEqual([
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
    ]);
  });

  it("lists seven consecutive dates for a week", () => {
    expect(weekDates("2026-08-17")).toEqual([
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
    ]);
  });

  it("admits today and yesterday, and nothing else", () => {
    const today = "2026-08-31";
    expect(isWithinEditWindow(today, today)).toBe(true);
    expect(isWithinEditWindow(addDays(today, -1), today)).toBe(true);
    expect(isWithinEditWindow(addDays(today, -2), today)).toBe(false);
    expect(isWithinEditWindow(addDays(today, 1), today)).toBe(false);
    expect(EDIT_WINDOW_DAYS).toBe(1);
  });
});

describe("computeWeekView", () => {
  const monday = "2026-08-17";

  it("fills each day's ratios independently", () => {
    const rows = [
      ...rowsForDay("2026-08-17", ["completed", "completed", "missed", "missed"]),
      ...rowsForDay("2026-08-19", ["completed", "completed", "completed", "completed"]),
    ];
    const week = computeWeekView(rows, monday, "2026-08-23");

    expect(week.completionRatio[0]).toBe(0.5);
    expect(week.missedRatio[0]).toBe(0.5);
    expect(week.completionRatio[1]).toBe(0);
    expect(week.completionRatio[2]).toBe(1);
  });

  it("excludes removed and rescheduled rows from the denominator", () => {
    const rows = rowsForDay("2026-08-17", [
      "completed",
      "removed",
      "rescheduled",
    ]);
    const week = computeWeekView(rows, monday, "2026-08-23");
    expect(week.completionRatio[0]).toBe(1);
  });

  it("rates only elapsed days, so planning ahead cannot lower the rate", () => {
    const rows = [
      ...rowsForDay("2026-08-17", ["completed", "completed"]),
      // Tomorrow, pre-generated by Plan Tomorrow.
      ...rowsForDay("2026-08-19", ["pending", "pending", "pending"]),
    ];
    const week = computeWeekView(rows, monday, "2026-08-18");
    expect(week.completionRate).toBe(100);
  });

  it("counts every day of a week that has fully elapsed", () => {
    const rows = [
      ...rowsForDay("2026-08-17", ["completed", "completed"]),
      ...rowsForDay("2026-08-19", ["missed", "missed"]),
    ];
    const week = computeWeekView(rows, monday, "2026-09-01");
    expect(week.completionRate).toBe(50);
  });

  it("reports zero rather than dividing by nothing on an empty week", () => {
    const week = computeWeekView([], monday, "2026-09-01");
    expect(week.completionRate).toBe(0);
    expect(week.completionRatio).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
