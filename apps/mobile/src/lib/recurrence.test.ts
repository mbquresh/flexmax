import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {},
}));
import {
  describeRecurrence,
  formatEndDate,
  overrideDays,
  resolveBlockTimes,
  setOverride,
} from "./recurrence";

const BASE = { start_minutes: 360, end_minutes: 420 };

describe("resolveBlockTimes", () => {
  it("uses the override when present for that day", () => {
    expect(
      resolveBlockTimes(
        { ...BASE, time_overrides: { "6": { start: 540, end: 600 } } },
        6
      )
    ).toEqual({ start: 540, end: 600 });
  });

  it("falls back to base times when that day has no override", () => {
    expect(
      resolveBlockTimes(
        { ...BASE, time_overrides: { "6": { start: 540, end: 600 } } },
        1
      )
    ).toEqual({ start: 360, end: 420 });
  });

  it("falls back to base times when time_overrides is null", () => {
    expect(resolveBlockTimes({ ...BASE, time_overrides: null }, 6)).toEqual({
      start: 360,
      end: 420,
    });
  });
});

describe("setOverride", () => {
  it("adds a day's times", () => {
    expect(setOverride(null, 6, { start: 540, end: 600 })).toEqual({
      "6": { start: 540, end: 600 },
    });
  });

  it("removes a day's override", () => {
    expect(
      setOverride(
        { "6": { start: 540, end: 600 }, "0": { start: 480, end: 540 } },
        6,
        null
      )
    ).toEqual({
      "0": { start: 480, end: 540 },
    });
  });
});

describe("overrideDays", () => {
  it("returns sorted day numbers", () => {
    expect(
      overrideDays({
        "6": { start: 1, end: 2 },
        "0": { start: 1, end: 2 },
        "3": { start: 1, end: 2 },
      })
    ).toEqual([0, 3, 6]);
  });

  it("returns an empty list when time_overrides is null", () => {
    expect(overrideDays(null)).toEqual([]);
  });
});

describe("describeRecurrence", () => {
  it("returns Never when no days are selected", () => {
    expect(describeRecurrence([], 1, null)).toBe("Never");
    expect(describeRecurrence([], 3, "2026-09-04")).toBe("Never");
  });

  it("names all seven days as every day", () => {
    expect(describeRecurrence([0, 1, 2, 3, 4, 5, 6], 1, null)).toBe(
      "Every week on every day"
    );
  });

  it("names weekdays and weekends", () => {
    expect(describeRecurrence([1, 2, 3, 4, 5], 1, null)).toBe(
      "Every week on weekdays"
    );
    expect(describeRecurrence([0, 6], 1, null)).toBe(
      "Every week on weekends"
    );
  });

  it("joins an arbitrary subset in weekday order", () => {
    expect(describeRecurrence([3, 1], 1, null)).toBe(
      "Every week on Mon, Wed"
    );
  });

  it("uses Every N weeks when the interval is not 1", () => {
    expect(describeRecurrence([1, 2, 3, 4, 5], 3, null)).toBe(
      "Every 3 weeks on weekdays"
    );
  });

  it("appends a locally parsed end date", () => {
    expect(describeRecurrence([1, 2, 3, 4, 5], 1, "2026-09-04")).toBe(
      `Every week on weekdays · until ${formatEndDate("2026-09-04")}`
    );
  });
});
