import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {},
}));

import { planShortenTemplate } from "./remedy";

function misses(n: number, extras: { status: string; completion_rating?: string | null }[] = []) {
  return [
    ...Array.from({ length: n }, () => ({ status: "missed" as const })),
    ...extras,
  ];
}

describe("planShortenTemplate", () => {
  it("offers half duration after 4 misses in 7 resolved", () => {
    const history = [
      ...misses(4),
      { status: "completed" },
      { status: "completed" },
      { status: "completed" },
    ];
    expect(planShortenTemplate(60, history)).toEqual({
      kind: "shorten",
      fromMinutes: 60,
      toMinutes: 30,
    });
  });

  it("offers after 4 poor ratings even when the block completed", () => {
    const history = Array.from({ length: 7 }, () => ({
      status: "completed",
      completion_rating: "pulled_away",
    }));
    history[0] = { status: "completed", completion_rating: "partial" };
    expect(planShortenTemplate(90, history)).toEqual({
      kind: "shorten",
      fromMinutes: 90,
      toMinutes: 45,
    });
  });

  it("does not offer on a thin window", () => {
    expect(planShortenTemplate(60, misses(3))).toBeNull();
  });

  it("does not offer when 3 of 7 missed", () => {
    const history = [
      ...misses(3),
      { status: "completed" },
      { status: "completed" },
      { status: "completed" },
      { status: "completed" },
    ];
    expect(planShortenTemplate(60, history)).toBeNull();
  });

  it("does not offer when the block is already short", () => {
    expect(planShortenTemplate(30, misses(7))).toBeNull();
  });

  it("ignores pending rows when building the window", () => {
    const history = [
      { status: "pending" },
      ...misses(4),
      { status: "completed" },
      { status: "completed" },
      { status: "completed" },
    ];
    expect(planShortenTemplate(60, history)?.toMinutes).toBe(30);
  });
});
