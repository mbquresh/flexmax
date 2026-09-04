import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {},
}));

import { DailyInstance, ScheduleBlock } from "../types/database";
import {
  findRescheduleSlot,
  placeShrunkBlock,
  planDisplacement,
  planRestore,
  planShrinkToFit,
  resolveDayBoundaries,
  resolveDayEnd,
} from "./schedule";

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
    is_active: true,
    starts_on: null,
    ends_on: null,
    interval_weeks: 1,
    anchor_date: null,
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
    quality_reason_note: null,
    actual_end_minutes: null,
    rescheduled_to_id: null,
    reschedule_count: 0,
    original_start_minutes: null,
    original_end_minutes: null,
    displaced_by_id: null,
    is_fixed: false,
    removed_reason: null,
    removed_by: null,
    backfilled_at: null,
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

  it("returns clear when the slot overlaps a completed instance", () => {
    const done = instance({
      id: "done",
      start_minutes: 610,
      end_minutes: 670,
      status: "completed",
      block: block({ name: "Deep work" }),
    });
    const plan = planDisplacement(
      { start_minutes: 600, end_minutes: 660 },
      [missed, done],
      missed.id
    );
    expect(plan).toEqual({ kind: "clear" });
    expect(plan.kind).not.toBe("push");
    expect(plan.kind).not.toBe("sacrifice");
  });

  it("returns clear when the slot overlaps a missed instance", () => {
    const alreadyMissed = instance({
      id: "already-missed",
      start_minutes: 610,
      end_minutes: 670,
      status: "missed",
      block: block({ name: "Cardio" }),
    });
    const plan = planDisplacement(
      { start_minutes: 600, end_minutes: 660 },
      [missed, alreadyMissed],
      missed.id
    );
    expect(plan).toEqual({ kind: "clear" });
  });

  it("still collides with a pending instance in the slot", () => {
    const dinner = instance({
      id: "dinner",
      start_minutes: 630,
      end_minutes: 690,
      status: "pending",
      block: block({ name: "Dinner" }),
    });
    const plan = planDisplacement(
      { start_minutes: 600, end_minutes: 660 },
      [missed, dinner],
      missed.id
    );
    expect(plan.kind).toBe("push");
    if (plan.kind !== "push") return;
    expect(plan.target.id).toBe("dinner");
  });

  it("names only the pending collider when a completed block also overlaps", () => {
    const done = instance({
      id: "done",
      start_minutes: 610,
      end_minutes: 640,
      status: "completed",
      block: block({ name: "Deep work" }),
    });
    const dinner = instance({
      id: "dinner",
      start_minutes: 630,
      end_minutes: 690,
      status: "pending",
      block: block({ name: "Dinner" }),
    });
    const plan = planDisplacement(
      { start_minutes: 600, end_minutes: 660 },
      [missed, done, dinner],
      missed.id
    );
    expect(plan.kind).toBe("push");
    if (plan.kind !== "push") return;
    expect(plan.target.id).toBe("dinner");
  });
});

describe("planRestore", () => {
  const MIN = 5;

  const gone = instance({
    id: "gone",
    start_minutes: 600,
    end_minutes: 660,
    status: "removed",
    removed_by: "user",
    block: block({ name: "Cardio" }),
  });

  beforeEach(() => {
    vi.useFakeTimers();
    // 9:00 — original 10:00–11:00 is still ahead.
    vi.setSystemTime(new Date(2026, 7, 28, 9, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns clear when the original window is free and still ahead", () => {
    const elsewhere = instance({
      id: "elsewhere",
      start_minutes: 700,
      end_minutes: 760,
      block: block({ name: "Dinner" }),
    });
    expect(planRestore(gone, [gone, elsewhere], MIN)).toEqual({ kind: "clear" });
  });

  it("does not return clear when the original window is free but already passed", () => {
    vi.setSystemTime(new Date(2026, 7, 28, 12, 0, 0));
    const plan = planRestore(gone, [gone], MIN);
    expect(plan.kind).not.toBe("clear");
    expect(plan).toEqual({
      kind: "relocate",
      start: 750,
      end: 810,
    });
  });

  it("relocates to a later full-length gap when the original window is taken", () => {
    const covering = instance({
      id: "covering",
      start_minutes: 600,
      end_minutes: 660,
      block: block({ name: "Deep work" }),
    });
    expect(planRestore(gone, [gone, covering], MIN)).toEqual({
      kind: "relocate",
      start: 660,
      end: 720,
    });
  });

  it("shrinks to the largest remaining gap when no full-length slot exists", () => {
    const morning = instance({
      id: "morning",
      start_minutes: 0,
      end_minutes: 900,
      block: block({ name: "Deep work" }),
    });
    const evening = instance({
      id: "evening",
      start_minutes: 940,
      end_minutes: 1440,
      block: block({ name: "Dinner" }),
    });
    expect(planRestore(gone, [gone, morning, evening], MIN)).toEqual({
      kind: "shrink",
      start: 900,
      end: 940,
      lostMinutes: 20,
    });
  });

  it("picks the larger of two shortened gaps", () => {
    const a = instance({
      id: "a",
      start_minutes: 0,
      end_minutes: 800,
      block: block({ name: "A" }),
    });
    const b = instance({
      id: "b",
      start_minutes: 840,
      end_minutes: 1200,
      block: block({ name: "B" }),
    });
    const c = instance({
      id: "c",
      start_minutes: 1250,
      end_minutes: 1440,
      block: block({ name: "C" }),
    });
    expect(planRestore(gone, [gone, a, b, c], MIN)).toEqual({
      kind: "shrink",
      start: 1200,
      end: 1250,
      lostMinutes: 10,
    });
  });

  it("blocks when every surviving gap is under minMinutes", () => {
    vi.setSystemTime(new Date(2026, 7, 28, 22, 0, 0));
    const packed = instance({
      id: "packed",
      start_minutes: 1350,
      end_minutes: 1380,
      block: block({ name: "Packed" }),
    });
    expect(planRestore(gone, [gone, packed], MIN, 1380, 360)).toEqual({
      kind: "blocked",
    });
  });

  it("clips a gap that would end past the sleep target", () => {
    vi.setSystemTime(new Date(2026, 7, 28, 21, 0, 0));
    expect(planRestore(gone, [gone], MIN, 1320, 360)).toEqual({
      kind: "shrink",
      start: 1290,
      end: 1320,
      lostMinutes: 30,
    });
  });

  it("blocks when the clipped remainder is under minMinutes", () => {
    vi.setSystemTime(new Date(2026, 7, 28, 21, 0, 0));
    expect(planRestore(gone, [gone], MIN, 1293, 360)).toEqual({
      kind: "blocked",
    });
  });

  it("finds slots when sleep is 1am, because resolveDayEnd clamps to 1440", () => {
    vi.setSystemTime(new Date(2026, 7, 28, 22, 0, 0));
    expect(planRestore(gone, [gone], MIN, 60, 360)).toEqual({
      kind: "relocate",
      start: 1350,
      end: 1410,
    });
  });

  it("ignores removed, missed, and completed instances as blockers", () => {
    const alsoRemoved = instance({
      id: "also-removed",
      start_minutes: 610,
      end_minutes: 650,
      status: "removed",
      block: block({ name: "Removed" }),
    });
    const alreadyMissed = instance({
      id: "already-missed",
      start_minutes: 615,
      end_minutes: 655,
      status: "missed",
      block: block({ name: "Missed" }),
    });
    const done = instance({
      id: "done",
      start_minutes: 620,
      end_minutes: 660,
      status: "completed",
      block: block({ name: "Done" }),
    });
    expect(
      planRestore(gone, [gone, alsoRemoved, alreadyMissed, done], MIN)
    ).toEqual({ kind: "clear" });
  });
});

describe("planShrinkToFit", () => {
  // Cardio 10:00–11:00. The missed block wants 10:00–10:30, which is the
  // sacrifice case planDisplacement cannot resolve any other way.
  const cardio = instance({
    id: "cardio",
    start_minutes: 600,
    end_minutes: 660,
    block: block({ name: "Cardio" }),
  });
  const slot = { start_minutes: 600, end_minutes: 630 };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 28, 9, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers half the original length by default", () => {
    const plan = planShrinkToFit(slot, cardio, [missed, cardio], missed.id);
    expect(plan).not.toBeNull();
    expect(plan?.name).toBe("Cardio");
    expect(plan?.originalMinutes).toBe(60);
    expect(plan?.defaultMinutes).toBe(30);
  });

  it("caps maxMinutes at the original length, never above it", () => {
    const plan = planShrinkToFit(slot, cardio, [missed, cardio], missed.id);
    expect(plan?.maxMinutes).toBe(60);
  });

  it("caps maxMinutes at the largest remaining gap", () => {
    // 10:00 now, so the only space left is 10:30–11:45 minus Dinner.
    vi.setSystemTime(new Date(2026, 7, 28, 10, 0, 0));
    const dinner = instance({
      id: "dinner",
      start_minutes: 660,
      end_minutes: 705,
      block: block({ name: "Dinner" }),
    });
    const plan = planShrinkToFit(
      slot,
      cardio,
      [missed, cardio, dinner],
      missed.id,
      705,
      360
    );
    expect(plan?.maxMinutes).toBe(30);
    expect(plan?.defaultMinutes).toBe(30);
  });

  it("returns null when nothing is left that clears the floor", () => {
    vi.setSystemTime(new Date(2026, 7, 28, 10, 0, 0));
    const wall = instance({
      id: "wall",
      start_minutes: 630,
      end_minutes: 1440,
      block: block({ name: "Wall" }),
    });
    expect(
      planShrinkToFit(slot, cardio, [missed, cardio, wall], missed.id)
    ).toBeNull();
  });

  it("counts the window the rescheduled block is vacating as free", () => {
    // Cardio was 10:00–11:00 and the missed 8:00 block takes 10:00–10:30.
    // 9:00–10:00 is genuinely open, and at 9:00 it is the largest space
    // left — so the full hour stays on the table.
    const wall = instance({
      id: "wall",
      start_minutes: 630,
      end_minutes: 1440,
      block: block({ name: "Wall" }),
    });
    const plan = planShrinkToFit(slot, cardio, [missed, cardio, wall], missed.id);
    expect(plan?.maxMinutes).toBe(60);
  });

  it("refuses a fixed target", () => {
    const fixed = instance({
      ...cardio,
      id: "fixed-cardio",
      is_fixed: true,
    });
    expect(
      planShrinkToFit(slot, fixed, [missed, fixed], missed.id)
    ).toBeNull();
  });

  it("never offers a duration it cannot place", () => {
    const dinner = instance({
      id: "dinner",
      start_minutes: 700,
      end_minutes: 760,
      block: block({ name: "Dinner" }),
    });
    const all = [missed, cardio, dinner];
    const plan = planShrinkToFit(slot, cardio, all, missed.id, 1320, 360);
    expect(plan).not.toBeNull();
    if (!plan) return;

    for (let d = plan.minMinutes; d <= plan.maxMinutes; d++) {
      expect(
        placeShrunkBlock(slot, cardio, d, all, missed.id, 1320, 360)
      ).not.toBeNull();
    }
  });
});

describe("placeShrunkBlock", () => {
  const cardio = instance({
    id: "cardio",
    start_minutes: 600,
    end_minutes: 660,
    block: block({ name: "Cardio" }),
  });
  const slot = { start_minutes: 600, end_minutes: 630 };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 28, 9, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("places the shortened block immediately after the reschedule slot", () => {
    expect(
      placeShrunkBlock(slot, cardio, 30, [missed, cardio], missed.id)
    ).toEqual({ start: 630, end: 660 });
  });

  it("does not place it in free time before its own original start", () => {
    // 9:00 now, Cardio was 10:00. A 30 minute block would fit at 9:00 but
    // that is ahead of the block it just made room for.
    const placed = placeShrunkBlock(slot, cardio, 30, [missed, cardio], missed.id);
    expect(placed?.start).toBeGreaterThanOrEqual(cardio.start_minutes);
  });

  it("falls back to an earlier gap when nothing later fits", () => {
    const wall = instance({
      id: "wall",
      start_minutes: 630,
      end_minutes: 1440,
      block: block({ name: "Wall" }),
    });
    // 8:00 now, so 8:00–10:00 is open ahead of the slot.
    vi.setSystemTime(new Date(2026, 7, 28, 8, 0, 0));
    expect(
      placeShrunkBlock(slot, cardio, 30, [missed, cardio, wall], missed.id)
    ).toEqual({ start: 480, end: 510 });
  });

  it("never runs past the sleep boundary", () => {
    vi.setSystemTime(new Date(2026, 7, 28, 10, 0, 0));
    const dinner = instance({
      id: "dinner",
      start_minutes: 630,
      end_minutes: 1300,
      block: block({ name: "Dinner" }),
    });
    expect(
      placeShrunkBlock(slot, cardio, 60, [missed, cardio, dinner], missed.id, 1330, 360)
    ).toBeNull();
  });

  it("refuses a duration under the floor", () => {
    expect(
      placeShrunkBlock(slot, cardio, 1, [missed, cardio], missed.id)
    ).toBeNull();
  });

  it("ignores resolved blocks when looking for space", () => {
    const done = instance({
      id: "done",
      start_minutes: 630,
      end_minutes: 720,
      status: "completed",
      block: block({ name: "Done" }),
    });
    expect(
      placeShrunkBlock(slot, cardio, 30, [missed, cardio, done], missed.id)
    ).toEqual({ start: 630, end: 660 });
  });
});

describe("resolveDayEnd", () => {
  it("returns 1440 when sleep is null", () => {
    expect(resolveDayEnd(null, 360)).toBe(1440);
  });

  it("returns the sleep time when it is after wake on the same day", () => {
    expect(resolveDayEnd(1380, 360)).toBe(1380);
  });

  it("clamps to 1440 when sleep crosses midnight past wake", () => {
    expect(resolveDayEnd(60, 360)).toBe(1440);
  });

  it("clamps to 1440 when sleep is before 4am and wake is unset", () => {
    expect(resolveDayEnd(120, null)).toBe(1440);
  });

  it("keeps a same-day sleep when wake is unset and sleep is after 4am", () => {
    expect(resolveDayEnd(300, null)).toBe(300);
  });

  it("clamps to 1440 when sleep equals wake", () => {
    expect(resolveDayEnd(360, 360)).toBe(1440);
  });
});

describe("resolveDayBoundaries", () => {
  const defaults = { wake: 360, sleep: 1380 };

  it("returns defaults when there are no overrides", () => {
    expect(resolveDayBoundaries(1, defaults, null)).toEqual(defaults);
    expect(resolveDayBoundaries(1, defaults, {})).toEqual(defaults);
  });

  it("overrides only the fields present for that day", () => {
    expect(
      resolveDayBoundaries(6, defaults, { "6": { sleep: 60 } })
    ).toEqual({ wake: 360, sleep: 60 });
  });

  it("ignores an override for a different day", () => {
    expect(
      resolveDayBoundaries(1, defaults, { "6": { sleep: 60 } })
    ).toEqual(defaults);
  });

  it("falls back to the default when the override field is explicitly null", () => {
    expect(
      resolveDayBoundaries(1, defaults, { "1": { wake: null } })
    ).toEqual(defaults);
  });
});

describe("findRescheduleSlot", () => {
  it("returns a window that only contains a completed block as available", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 28, 10, 0, 0));
    try {
      const done = instance({
        id: "done",
        start_minutes: 630,
        end_minutes: 690,
        status: "completed",
        block: block({ name: "Deep work" }),
      });
      const morning = instance({
        id: "morning",
        start_minutes: 480,
        end_minutes: 540,
        status: "missed",
        block: block({ name: "Gym" }),
      });
      expect(findRescheduleSlot(morning, [morning, done])).toEqual({
        start_minutes: 630,
        end_minutes: 690,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not offer the missed block's own window as a slot", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 28, 14, 0, 0));
    try {
      const packed = instance({
        id: "packed",
        start_minutes: 870,
        end_minutes: 1080,
        status: "pending",
        block: block({ name: "Deep work" }),
      });
      const workout = instance({
        id: "workout",
        start_minutes: 1080,
        end_minutes: 1140,
        status: "missed",
        block: block({ name: "Gym" }),
      });
      // 2pm, afternoon filled until 6pm. The gym's own 6–7pm hour is the
      // first gap that fits — that is where it already is, not a move.
      expect(findRescheduleSlot(workout, [packed, workout])).toEqual({
        start_minutes: 1140,
        end_minutes: 1200,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns null when the only fit is the missed block's own window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 28, 20, 30, 0));
    try {
      const packed = instance({
        id: "packed",
        start_minutes: 1260,
        end_minutes: 1380,
        status: "pending",
        block: block({ name: "Dinner" }),
      });
      const workout = instance({
        id: "workout",
        start_minutes: 1380,
        end_minutes: 1440,
        status: "missed",
        block: block({ name: "Gym" }),
      });
      // 8:30pm + 30 buffer = 9pm. Dinner holds 9–11. The gym's own 11–12
      // is the only remaining hour, and nothing fits after midnight.
      expect(findRescheduleSlot(workout, [packed, workout])).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
