import { describe, expect, it } from "vitest";
import { cutoffNudgeLine } from "./cutoffNudge";
import { BehavioralInsight } from "../types/database";

function insight(
  overrides: Partial<BehavioralInsight> & Pick<BehavioralInsight, "kind" | "rank">
): BehavioralInsight {
  return {
    id: overrides.id ?? "1",
    belief: overrides.belief ?? "test",
    suggestion: overrides.suggestion ?? null,
    related_blocks: overrides.related_blocks ?? [],
    generated_at: overrides.generated_at ?? "2026-08-01T00:00:00Z",
    nudge_line: overrides.nudge_line ?? null,
    disputed_at: overrides.disputed_at ?? null,
    ...overrides,
  };
}

const keystone = insight({
  kind: "structural",
  rank: 1,
  related_blocks: ["Deep work morning", "Deep work afternoon"],
  nudge_line: "morning session failing has cost the afternoon 10 of 15 times",
});

const overrun = insight({
  kind: "pattern",
  rank: 2,
  related_blocks: ["Deep work morning", "Deep work afternoon"],
  nudge_line: "morning deep work running over has cost the afternoon 4 of 7 times",
});

describe("cutoffNudgeLine", () => {
  it("does not attach a keystone about the next block to this one", () => {
    expect(cutoffNudgeLine([keystone], "Cardio", "Deep work afternoon")).toBeNull();
  });

  it("does not use a structural line even when this block is named", () => {
    expect(
      cutoffNudgeLine([keystone], "Deep work morning", "Deep work afternoon")
    ).toBeNull();
  });

  it("uses an overrun line that names this block, preferring one that also names next", () => {
    const other = insight({
      id: "3",
      kind: "causal",
      rank: 3,
      related_blocks: ["Cardio"],
      nudge_line: "cardio running over has cost dinner 3 of 6 times",
    });
    expect(cutoffNudgeLine([other, overrun], "Deep work morning", "Deep work afternoon")).toBe(
      overrun.nudge_line
    );
  });

  it("falls back to this block's overrun line when next is not in related_blocks", () => {
    expect(cutoffNudgeLine([overrun], "Deep work morning")).toBe(overrun.nudge_line);
  });

  it("skips strengths", () => {
    const s = insight({
      kind: "strength",
      rank: 1,
      related_blocks: ["Cardio"],
      nudge_line: "you finish this one",
    });
    expect(cutoffNudgeLine([s], "Cardio")).toBeNull();
  });
});
