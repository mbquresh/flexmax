import { describe, expect, it } from "vitest";
import { buildRecoveryCopy, findInsightForBlock } from "./recoveryCopy";
import { BehavioralInsight } from "../types/database";

const intention = { text: "Focus on form", date: "2026-08-10" };

function insight(
  overrides: Partial<BehavioralInsight> & Pick<BehavioralInsight, "kind" | "rank">
): BehavioralInsight {
  return {
    id: overrides.id ?? "1",
    belief: overrides.belief ?? "test",
    suggestion: overrides.suggestion ?? null,
    related_blocks: overrides.related_blocks ?? ["Gym"],
    generated_at: overrides.generated_at ?? "2026-08-01T00:00:00Z",
    nudge_line: overrides.nudge_line ?? null,
    ...overrides,
  };
}

describe("buildRecoveryCopy", () => {
  it("returns null headline and note for an empty window", () => {
    const result = buildRecoveryCopy("Gym", [], "2026-08-18", intention);

    expect(result).toEqual({
      headline: null,
      structuralNote: null,
      lastIntention: intention,
      suppressInsight: false,
    });
  });

  it("returns null headline for a genuine one-off miss after a single prior landing", () => {
    const result = buildRecoveryCopy(
      "Gym",
      [
        { date: "2026-08-18", status: "missed" },
        { date: "2026-08-17", status: "completed" },
      ],
      "2026-08-18",
      intention
    );

    expect(result.headline).toBeNull();
    expect(result.structuralNote).toBeNull();
    expect(result.suppressInsight).toBe(false);
    expect(result.lastIntention).toBe(intention);
  });

  it("names a broken run and suppresses insight when a real streak just broke", () => {
    const result = buildRecoveryCopy(
      "Gym",
      [
        { date: "2026-08-18", status: "missed" },
        { date: "2026-08-17", status: "completed" },
        { date: "2026-08-16", status: "completed" },
        { date: "2026-08-15", status: "completed" },
      ],
      "2026-08-18",
      intention
    );

    expect(result.headline).toBe("Gym had a 3-day run going.");
    expect(result.structuralNote).toBeNull();
    expect(result.suppressInsight).toBe(true);
    expect(result.lastIntention).toBe(intention);
  });

  it("uses week-scale copy when the block never landed in the window", () => {
    const result = buildRecoveryCopy(
      "Gym",
      [
        { date: "2026-08-18", status: "missed" },
        { date: "2026-08-11", status: "missed" },
      ],
      "2026-08-18",
      null
    );

    expect(result.headline).toBe("Gym hasn't landed in about a week.");
    expect(result.structuralNote).toContain("Same slot");
    expect(result.lastIntention).toBeNull();
  });

  it("treats trailing unaccounted rows as transparent for prior-run detection", () => {
    const withoutUnaccounted = buildRecoveryCopy(
      "Gym",
      [
        { date: "2026-08-18", status: "missed" },
        { date: "2026-08-17", status: "completed" },
        { date: "2026-08-16", status: "completed" },
        { date: "2026-08-15", status: "completed" },
      ],
      "2026-08-18",
      null
    );

    const withTrailingUnaccounted = buildRecoveryCopy(
      "Gym",
      [
        { date: "2026-08-18", status: "missed" },
        { date: "2026-08-17", status: "completed" },
        { date: "2026-08-16", status: "completed" },
        { date: "2026-08-15", status: "completed" },
        { date: "2026-08-14", status: "unaccounted" },
      ],
      "2026-08-18",
      null
    );

    expect(withTrailingUnaccounted.headline).toBe(withoutUnaccounted.headline);
    expect(withTrailingUnaccounted.suppressInsight).toBe(withoutUnaccounted.suppressInsight);
  });

  it("passes lastIntention through on early-return branches", () => {
    const empty = buildRecoveryCopy("Gym", [], "2026-08-18", intention);
    const oneOff = buildRecoveryCopy(
      "Gym",
      [
        { date: "2026-08-18", status: "missed" },
        { date: "2026-08-17", status: "completed" },
      ],
      "2026-08-18",
      intention
    );
    const brokenRun = buildRecoveryCopy(
      "Gym",
      [
        { date: "2026-08-18", status: "missed" },
        { date: "2026-08-17", status: "completed" },
        { date: "2026-08-16", status: "completed" },
      ],
      "2026-08-18",
      intention
    );

    expect(empty.lastIntention).toBe(intention);
    expect(oneOff.lastIntention).toBe(intention);
    expect(brokenRun.lastIntention).toBe(intention);
  });
});

describe("findInsightForBlock", () => {
  const insights: BehavioralInsight[] = [
    insight({ id: "a", kind: "pattern", rank: 2, related_blocks: ["Gym"] }),
    insight({ id: "b", kind: "pattern", rank: 1, related_blocks: ["Gym", "Run"] }),
    insight({ id: "c", kind: "strength", rank: 0, related_blocks: ["Gym"] }),
    insight({ id: "d", kind: "pattern", rank: 3, related_blocks: ["Read"] }),
  ];

  it("returns null when no insight lists the block", () => {
    expect(findInsightForBlock(insights, "Weights")).toBeNull();
  });

  it("excludes strength insights even when they match", () => {
    const onlyStrength = [insight({ id: "c", kind: "strength", rank: 0, related_blocks: ["Gym"] })];
    expect(findInsightForBlock(onlyStrength, "Gym")).toBeNull();
  });

  it("returns the lowest rank among multiple matches", () => {
    expect(findInsightForBlock(insights, "Gym")?.id).toBe("b");
  });
});
