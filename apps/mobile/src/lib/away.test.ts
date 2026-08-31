import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {},
}));

import { formatAwayRange, isCurrent } from "./away";
import { getLocalDateString } from "./time";
import { AwayPeriod } from "../types/database";

function period(starts_on: string, ends_on: string): AwayPeriod {
  return {
    id: "1",
    user_id: "u",
    starts_on,
    ends_on,
    label: null,
    created_at: "",
  };
}

function shift(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}

describe("formatAwayRange", () => {
  it("collapses a single-day range to one date", () => {
    const expected = new Date(2026, 8, 4).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    expect(formatAwayRange(period("2026-09-04", "2026-09-04"))).toBe(expected);
  });

  it("shows both dates for a multi-day range", () => {
    const start = new Date(2026, 8, 4).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const end = new Date(2026, 8, 10).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    expect(formatAwayRange(period("2026-09-04", "2026-09-10"))).toBe(
      `${start} – ${end}`
    );
  });
});

describe("isCurrent", () => {
  it("is current when the range contains today", () => {
    expect(isCurrent(period(shift(-2), shift(2)))).toBe(true);
  });

  it("is not current when the range is wholly before today", () => {
    expect(isCurrent(period(shift(-10), shift(-1)))).toBe(false);
  });

  it("is not current when the range is wholly after today", () => {
    expect(isCurrent(period(shift(1), shift(5)))).toBe(false);
  });

  it("is current when the start equals today", () => {
    expect(isCurrent(period(shift(0), shift(3)))).toBe(true);
  });

  it("is current when the end equals today", () => {
    expect(isCurrent(period(shift(-3), shift(0)))).toBe(true);
  });
});
