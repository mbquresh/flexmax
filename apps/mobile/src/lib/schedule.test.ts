import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {},
}));

import { DailyInstance, ScheduleBlock } from "../types/database";
import { planDisplacement } from "./schedule";

function block(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id: "block-1",
    template_id: "tmpl-1",
    user_id: "user-1",
    name: "Dinner",
    category: "other",
    color: "#000",
    start_minutes: 0,
    end_minutes: 60,
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    sort_order: 0,
    is_fixed: false,
    ...overrides,
  };
}

function instance(
  overrides: Partial<DailyInstance> &
    Pick<DailyInstance, "id" | "start_minutes" | "end_minutes">
): DailyInstance {
  return {
    user_id: "user-1",
    block_id: "block-1",
    date: "2026-08-24",
    task_detail: null,
    status: "pending",
    completion_rating: null,
    rated_at: null,
    reflection_why: null,
    reflection_improve: null,
    reflected_at: null,
    acknowledged_at: null,
    miss_reason_tag: null,
    quality_reason_tag: null,
    actual_end_minutes: null,
    rescheduled_to_id: null,
    reschedule_count: 0,
    original_start_minutes: null,
    original_end_minutes: null,
    displaced_by_id: null,
    is_fixed: false,
    removed_reason: null,
    block: block({ name: overrides.block?.name ?? "Dinner" }),
    ...overrides,
  };
}

const missed = instance({
  id: "missed",
  start_minutes: 480,
  end_minutes: 540,
  block: block({ name: "Gym" }),
});

describe("planDisplacement", () => {
  it("returns clear when the slot is empty", () => {
    const plan = planDisplacement(
      { start_minutes: 600, end_minutes: 660 },
      [missed],
      missed.id
    );
    expect(plan).toEqual({ kind: "clear" });
  });

  it("pushes one movable block, keeping its duration", () => {
    const dinner = instance({
      id: "dinner",
      start_minutes: 630,
      end_minutes: 690,
      block: block({ name: "Dinner" }),
    });
    const slot = { start_minutes: 600, end_minutes: 660 };
    const plan = planDisplacement(slot, [missed, dinner], missed.id);

    expect(plan.kind).toBe("push");
    if (plan.kind !== "push") return;
    expect(plan.target.id).toBe("dinner");
    expect(plan.newStart).toBe(660);
    expect(plan.newEnd).toBe(720);
    expect(plan.newEnd - plan.newStart).toBe(
      dinner.end_minutes - dinner.start_minutes
    );
  });

  it("sacrifices when the slot overlaps two blocks", () => {
    const a = instance({
      id: "a",
      start_minutes: 610,
      end_minutes: 640,
      block: block({ name: "A" }),
    });
    const b = instance({
      id: "b",
      start_minutes: 640,
      end_minutes: 680,
      block: block({ name: "B" }),
    });
    const plan = planDisplacement(
      { start_minutes: 600, end_minutes: 660 },
      [missed, a, b],
      missed.id
    );

    expect(plan.kind).toBe("sacrifice");
    if (plan.kind !== "sacrifice") return;
    expect(plan.names).toEqual(["A", "B"]);
  });

  it("blocks a collider with is_fixed true", () => {
    const locked = instance({
      id: "locked",
      start_minutes: 630,
      end_minutes: 690,
      is_fixed: true,
      block: block({ name: "Fajr" }),
    });
    const plan = planDisplacement(
      { start_minutes: 600, end_minutes: 660 },
      [missed, locked],
      missed.id
    );

    expect(plan).toEqual({
      kind: "blocked",
      reason: "fixed",
      names: ["Fajr"],
    });
  });

  it("blocks a collider whose block.is_fixed is true", () => {
    const locked = instance({
      id: "locked-block",
      start_minutes: 630,
      end_minutes: 690,
      is_fixed: false,
      block: block({ name: "Fajr", is_fixed: true }),
    });
    const plan = planDisplacement(
      { start_minutes: 600, end_minutes: 660 },
      [missed, locked],
      missed.id
    );

    expect(plan).toEqual({
      kind: "blocked",
      reason: "fixed",
      names: ["Fajr"],
    });
  });

  it("sacrifices when the push would end after sleepTargetMinutes", () => {
    const dinner = instance({
      id: "dinner",
      start_minutes: 1280,
      end_minutes: 1340,
      block: block({ name: "Dinner" }),
    });
    const plan = planDisplacement(
      { start_minutes: 1260, end_minutes: 1300 },
      [missed, dinner],
      missed.id,
      22 * 60
    );

    expect(plan.kind).toBe("sacrifice");
    if (plan.kind !== "sacrifice") return;
    expect(plan.names).toEqual(["Dinner"]);
    expect(plan.targets.map((t) => t.id)).toEqual(["dinner"]);
  });

  it("sacrifices when sleepTargetMinutes is null and the push would end after 1440", () => {
    const late = instance({
      id: "late",
      start_minutes: 1390,
      end_minutes: 1430,
      block: block({ name: "Wind down" }),
    });
    const plan = planDisplacement(
      { start_minutes: 1380, end_minutes: 1410 },
      [missed, late],
      missed.id,
      null
    );

    expect(plan.kind).toBe("sacrifice");
    if (plan.kind !== "sacrifice") return;
    expect(plan.names).toEqual(["Wind down"]);
    expect(plan.targets.map((t) => t.id)).toEqual(["late"]);
  });

  it("sacrifices when the push would land on a third block", () => {
    const dinner = instance({
      id: "dinner",
      start_minutes: 630,
      end_minutes: 690,
      block: block({ name: "Dinner" }),
    });
    const later = instance({
      id: "later",
      start_minutes: 700,
      end_minutes: 760,
      block: block({ name: "Walk" }),
    });
    const plan = planDisplacement(
      { start_minutes: 600, end_minutes: 660 },
      [missed, dinner, later],
      missed.id
    );

    expect(plan.kind).toBe("sacrifice");
    if (plan.kind !== "sacrifice") return;
    expect(plan.names).toEqual(["Dinner"]);
    expect(plan.targets.map((t) => t.id)).toEqual(["dinner"]);
  });

  it("ignores removed, skipped, and rescheduled instances as colliders", () => {
    const removed = instance({
      id: "removed",
      start_minutes: 610,
      end_minutes: 650,
      status: "removed",
      block: block({ name: "Removed" }),
    });
    const skipped = instance({
      id: "skipped",
      start_minutes: 620,
      end_minutes: 655,
      status: "skipped",
      block: block({ name: "Skipped" }),
    });
    const rescheduled = instance({
      id: "rescheduled",
      start_minutes: 625,
      end_minutes: 670,
      status: "rescheduled",
      block: block({ name: "Rescheduled" }),
    });
    const plan = planDisplacement(
      { start_minutes: 600, end_minutes: 660 },
      [missed, removed, skipped, rescheduled],
      missed.id
    );

    expect(plan).toEqual({ kind: "clear" });
  });

  it("never counts the excludeId instance as a collider", () => {
    const plan = planDisplacement(
      { start_minutes: 480, end_minutes: 540 },
      [missed],
      missed.id
    );
    expect(plan).toEqual({ kind: "clear" });
  });

  it("carries every colliding instance in a sacrifice plan, not just the first", () => {
    const a = instance({
      id: "a",
      start_minutes: 610,
      end_minutes: 640,
      block: block({ name: "A" }),
    });
    const b = instance({
      id: "b",
      start_minutes: 640,
      end_minutes: 680,
      block: block({ name: "B" }),
    });
    const c = instance({
      id: "c",
      start_minutes: 650,
      end_minutes: 700,
      block: block({ name: "C" }),
    });
    const plan = planDisplacement(
      { start_minutes: 600, end_minutes: 660 },
      [missed, a, b, c],
      missed.id
    );

    expect(plan.kind).toBe("sacrifice");
    if (plan.kind !== "sacrifice") return;
    expect(plan.targets.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(plan.names).toEqual(["A", "B", "C"]);
  });
});
