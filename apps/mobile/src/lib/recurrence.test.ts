import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {},
}));
import {
  describeRecurrence,
  formatEndDate,
  overrideDays,
  packedTimeOverrides,
  hasDistinctOverride,
  earliestResolvedStart,
  resolveBlockTimes,
  setOverride,
  shiftOverrides,
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

describe("packedTimeOverrides", () => {
  it("returns an empty object rather than null", () => {
    expect(packedTimeOverrides([1, 2, 3, 4, 5], null)).toEqual({});
    expect(packedTimeOverrides([1, 2, 3, 4, 5], {})).toEqual({});
  });

  it("drops overrides for days that are no longer in the repeat set", () => {
    expect(
      packedTimeOverrides([1, 2, 3, 4, 5], {
        "6": { start: 540, end: 600 },
        "1": { start: 360, end: 420 },
      })
    ).toEqual({ "1": { start: 360, end: 420 } });
  });

  it("drops overrides that match the base times", () => {
    expect(
      packedTimeOverrides(
        [0, 6],
        { "0": { start: 360, end: 420 } },
        { start: 360, end: 420 }
      )
    ).toEqual({});
  });
});

describe("hasDistinctOverride", () => {
  const block = {
    start_minutes: 360,
    end_minutes: 420,
    time_overrides: { "0": { start: 360, end: 420 }, "6": { start: 540, end: 600 } },
  };

  it("is false when the day's override matches the base", () => {
    expect(hasDistinctOverride(block, 0)).toBe(false);
  });

  it("is true when the day's override differs", () => {
    expect(hasDistinctOverride(block, 6)).toBe(true);
  });

  it("is false when the day has no override", () => {
    expect(hasDistinctOverride(block, 1)).toBe(false);
  });
});

describe("shiftOverrides", () => {
  it("moves every override by the same delta", () => {
    expect(
      shiftOverrides({ "6": { start: 540, end: 600 } }, 60, 60)
    ).toEqual({ "6": { start: 600, end: 660 } });
  });

  it("drops an override that would invert or leave the day", () => {
    expect(
      shiftOverrides({ "6": { start: 1380, end: 1440 } }, 120, 120)
    ).toEqual({});
  });
});

describe("earliestResolvedStart", () => {
  it("uses a single day's resolved time, not a leftover base", () => {
    expect(
      earliestResolvedStart({
        start_minutes: 360,
        end_minutes: 420,
        days_of_week: [6],
        time_overrides: { "6": { start: 1260, end: 1320 } },
      })
    ).toBe(1260);
  });

  it("returns the earliest resolved start across the week", () => {
    expect(
      earliestResolvedStart({
        start_minutes: 540,
        end_minutes: 600,
        days_of_week: [1, 6],
        time_overrides: { "6": { start: 360, end: 420 } },
      })
    ).toBe(360);
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
