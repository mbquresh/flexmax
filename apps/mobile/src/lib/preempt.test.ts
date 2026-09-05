import { describe, expect, it } from "vitest";
import { DailyInstance, ScheduleBlock } from "../types/database";
import {
  pickPreemptTarget,
  preemptBody,
  PreemptHistoryRow,
} from "./preempt";

function block(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id: "block-1",
    template_id: "tmpl-1",
    user_id: "user-1",
    name: "Gym",
    category: "health",
    color: "#000",
    start_minutes: 1080,
    end_minutes: 1140,
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    sort_order: 0,
    is_fixed: false,
    is_active: true,
    starts_on: null,
    ends_on: null,
    interval_weeks: 1,
    anchor_date: null,
    time_overrides: null,
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
    date: "2026-08-28",
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
    block: block({ name: overrides.block?.name ?? "Gym" }),
    ...overrides,
  };
}

function history(
  blockId: string,
  statuses: string[],
  startDate = "2026-08-27"
): PreemptHistoryRow[] {
  const start = new Date(`${startDate}T00:00:00`);
  return statuses.map((status, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return { block_id: blockId, date: `${year}-${month}-${day}`, status };
  });
}

const futureGym = instance({
  id: "gym-today",
  start_minutes: 1080,
  end_minutes: 1140,
});

describe("pickPreemptTarget", () => {
  it("returns null when history has fewer than 7 rows", () => {
    const hist = history("block-1", [
      "missed",
      "missed",
      "missed",
      "missed",
      "completed",
      "completed",
    ]);
    expect(pickPreemptTarget([futureGym], hist, 600)).toBeNull();
  });

  it("returns null at exactly 7 rows with 3 failures", () => {
    const hist = history("block-1", [
      "missed",
      "missed",
      "missed",
      "completed",
      "completed",
      "completed",
      "completed",
    ]);
    expect(pickPreemptTarget([futureGym], hist, 600)).toBeNull();
  });

  it("returns a candidate at exactly 7 rows with 4 failures, landed 3 of 7", () => {
    const hist = history("block-1", [
      "missed",
      "missed",
      "missed",
      "missed",
      "completed",
      "completed",
      "completed",
    ]);
    const picked = pickPreemptTarget([futureGym], hist, 600);
    expect(picked).toMatchObject({
      instanceId: "gym-today",
      blockId: "block-1",
      blockName: "Gym",
      startMinutes: 1080,
      landed: 3,
      total: 7,
    });
  });

  it("only counts the 7 most recent rows; older failures outside the window are ignored", () => {
    const hist = history("block-1", [
      "completed",
      "completed",
      "completed",
      "completed",
      "completed",
      "completed",
      "completed",
      "missed",
      "missed",
      "missed",
      "missed",
    ]);
    expect(pickPreemptTarget([futureGym], hist, 600)).toBeNull();
  });

  it("excludes a block whose start_minutes is already past", () => {
    const hist = history("block-1", [
      "missed",
      "missed",
      "missed",
      "missed",
      "completed",
      "completed",
      "completed",
    ]);
    expect(pickPreemptTarget([futureGym], hist, 1080)).toBeNull();
    expect(pickPreemptTarget([futureGym], hist, 1081)).toBeNull();
  });

  it("excludes a block whose status is not pending", () => {
    const hist = history("block-1", [
      "missed",
      "missed",
      "missed",
      "missed",
      "completed",
      "completed",
      "completed",
    ]);
    const done = instance({
      id: "gym-today",
      start_minutes: 1080,
      end_minutes: 1140,
      status: "completed",
    });
    expect(pickPreemptTarget([done], hist, 600)).toBeNull();
  });

  it("returns the block with fewer landed when two qualify", () => {
    const gym = instance({
      id: "gym-today",
      start_minutes: 1080,
      end_minutes: 1140,
      block_id: "gym",
      block: block({ id: "gym", name: "Gym" }),
    });
    const deep = instance({
      id: "deep-today",
      start_minutes: 540,
      end_minutes: 720,
      block_id: "deep",
      block: block({ id: "deep", name: "Deep work" }),
    });
    const hist = [
      ...history("gym", [
        "missed",
        "missed",
        "missed",
        "missed",
        "completed",
        "completed",
        "completed",
      ]),
      ...history("deep", [
        "missed",
        "missed",
        "missed",
        "missed",
        "missed",
        "completed",
        "completed",
      ]),
    ];
    const picked = pickPreemptTarget([gym, deep], hist, 400);
    expect(picked?.blockId).toBe("deep");
    expect(picked?.landed).toBe(2);
  });

  it("returns the earlier start when two qualifying blocks have equal records", () => {
    const later = instance({
      id: "later",
      start_minutes: 1080,
      end_minutes: 1140,
      block_id: "later",
      block: block({ id: "later", name: "Gym" }),
    });
    const earlier = instance({
      id: "earlier",
      start_minutes: 540,
      end_minutes: 600,
      block_id: "earlier",
      block: block({ id: "earlier", name: "Deep work" }),
    });
    const fourMisses = [
      "missed",
      "missed",
      "missed",
      "missed",
      "completed",
      "completed",
      "completed",
    ];
    const hist = [
      ...history("later", fourMisses),
      ...history("earlier", fourMisses),
    ];
    expect(pickPreemptTarget([later, earlier], hist, 400)?.blockId).toBe(
      "earlier"
    );
  });

  it("counts unaccounted as a failure alongside missed", () => {
    const hist = history("block-1", [
      "unaccounted",
      "unaccounted",
      "missed",
      "missed",
      "completed",
      "completed",
      "completed",
    ]);
    const picked = pickPreemptTarget([futureGym], hist, 600);
    expect(picked).toMatchObject({ landed: 3, total: 7 });
  });
});

describe("preemptBody", () => {
  it("states what landed, not what failed, and does not address the user", () => {
    const body = preemptBody({
      instanceId: "gym-today",
      blockId: "block-1",
      blockName: "Gym",
      startMinutes: 1080,
      landed: 3,
      total: 7,
    });
    expect(body).toBe("3 of the last 7 landed.");
    expect(body.toLowerCase()).not.toContain("you");
  });
});
