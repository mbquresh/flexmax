import { describe, expect, it } from "vitest";
import {
  insightAgeDays,
  insightCacheFresh,
  isInsightSlotDay,
} from "./insightCadence";

describe("isInsightSlotDay", () => {
  it("is Monday, Wednesday, Friday only", () => {
    expect(isInsightSlotDay("2026-09-14")).toBe(true); // Mon
    expect(isInsightSlotDay("2026-09-16")).toBe(true); // Wed
    expect(isInsightSlotDay("2026-09-18")).toBe(true); // Fri
    expect(isInsightSlotDay("2026-09-15")).toBe(false); // Tue
    expect(isInsightSlotDay("2026-09-19")).toBe(false); // Sat
    expect(isInsightSlotDay("2026-09-20")).toBe(false); // Sun
  });
});

describe("insightCacheFresh", () => {
  it("keeps a same-day reading", () => {
    expect(
      insightCacheFresh("2026-09-14T16:00:00.000Z", "2026-09-14")
    ).toBe(true);
  });

  it("refreshes on the next slot day", () => {
    expect(
      insightCacheFresh("2026-09-14T16:00:00.000Z", "2026-09-16")
    ).toBe(false);
  });

  it("holds through Tuesday after a Monday write", () => {
    expect(
      insightCacheFresh("2026-09-14T16:00:00.000Z", "2026-09-15")
    ).toBe(true);
  });

  it("refreshes after seven local days even off-slot", () => {
    expect(
      insightCacheFresh("2026-09-12T16:00:00.000Z", "2026-09-19")
    ).toBe(false);
    expect(insightAgeDays("2026-09-12T16:00:00.000Z", "2026-09-19")).toBe(7);
  });
});
