import { supabase } from "./supabase";
import { BlockCategory, DailyInstance, ScheduleBlock } from "../types/database";

export const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
] as const;

export const ALL_DAYS = WEEKDAYS.map((d) => d.value);

export type DayBoundaryOverrides = Record<
  string,
  { wake?: number | null; sleep?: number | null } | undefined
>;

export type DayBoundaries = { wake: number | null; sleep: number | null };

export function formatDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return "Every day";
  if (sorted.join(",") === "1,2,3,4,5") return "Mon–Fri";
  if (sorted.join(",") === "0,6") return "Weekends";
  return sorted
    .map((d) => WEEKDAYS.find((w) => w.value === d)?.label ?? "?")
    .join(", ");
}

export function getTodayDayOfWeek(): number {
  return new Date().getDay(); // 0=Sun ... 6=Sat
}

export function getTodayLabel(): string {
  return WEEKDAYS[getTodayDayOfWeek()].label;
}

export async function ensureActiveTemplate(userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("schedule_templates")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("schedule_templates")
    .insert({ user_id: userId, name: "My Schedule", is_active: true })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function createScheduleBlock(params: {
  userId: string;
  templateId: string;
  name: string;
  category: BlockCategory;
  startMinutes: number;
  endMinutes: number;
  sortOrder: number;
  daysOfWeek?: number[];
  isFixed?: boolean;
}): Promise<ScheduleBlock> {
  const { startMinutes: start_minutes, endMinutes: end_minutes } = params;

  if (end_minutes <= start_minutes) {
    throw new Error("End time must be after start time");
  }

  const days_of_week = params.daysOfWeek?.length ? params.daysOfWeek : ALL_DAYS;

  const { data, error } = await supabase
    .from("schedule_blocks")
    .insert({
      user_id: params.userId,
      template_id: params.templateId,
      name: params.name,
      category: params.category,
      start_minutes,
      end_minutes,
      days_of_week,
      sort_order: params.sortOrder,
      is_fixed: params.isFixed ?? false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBlockDays(blockId: string, daysOfWeek: number[]) {
  if (!daysOfWeek.length) {
    throw new Error("Pick at least one day");
  }

  const { data, error } = await supabase
    .from("schedule_blocks")
    .update({ days_of_week: daysOfWeek.sort((a, b) => a - b) })
    .eq("id", blockId)
    .select()
    .single();

  if (error) throw error;
  return data as ScheduleBlock;
}

export async function deleteScheduleBlock(blockId: string) {
  const { error } = await supabase.from("schedule_blocks").delete().eq("id", blockId);
  if (error) throw error;
}

export async function setBlockArchived(blockId: string, archived: boolean) {
  const { data, error } = await supabase
    .from("schedule_blocks")
    .update({ is_active: !archived })
    .eq("id", blockId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export const BLOCK_PRESETS = [
  {
    name: "Morning routine",
    category: "morning_routine" as BlockCategory,
    startMinutes: 6 * 60,
    endMinutes: 7 * 60,
  },
  {
    name: "Deep work",
    category: "deep_work" as BlockCategory,
    startMinutes: 9 * 60,
    endMinutes: 12 * 60,
  },
  {
    name: "Workout",
    category: "health" as BlockCategory,
    startMinutes: 18 * 60,
    endMinutes: 19 * 60,
  },
  {
    name: "Wind down",
    category: "wind_down" as BlockCategory,
    startMinutes: 21 * 60 + 30,
    endMinutes: 22 * 60 + 30,
  },
];

// Sparse overrides win per FIELD, not per day — someone can override
// Saturday's sleep without overriding its wake.
export function resolveDayBoundaries(
  dayOfWeek: number,
  defaults: { wake: number | null; sleep: number | null },
  overrides: DayBoundaryOverrides | null | undefined
): DayBoundaries {
  const o = overrides?.[String(dayOfWeek)];
  return {
    wake: o?.wake ?? defaults.wake,
    sleep: o?.sleep ?? defaults.sleep,
  };
}

// A sleep target at or before wake crosses midnight. Instances are stored
// as minutes-since-midnight on a single date, so there is no representable
// slot past 1440 — the last usable minute of the day IS midnight. Without
// this, a 1am bedtime yields dayEnd = 60 and rejects every slot after 1am,
// which is all of them.
export function resolveDayEnd(
  sleepMinutes: number | null | undefined,
  wakeMinutes: number | null | undefined
): number {
  if (sleepMinutes == null) return 1440;
  const crossesMidnight =
    wakeMinutes != null ? sleepMinutes <= wakeMinutes : sleepMinutes < 240;
  return crossesMidnight ? 1440 : sleepMinutes;
}

// Only UNRESOLVED instances occupy time. 'completed' and 'missed' are
// historical facts: the first already happened, the second is not going
// to. Neither can be displaced and neither blocks a slot.
//
// Allowlist, not denylist. The previous denylist excluded skipped,
// removed and rescheduled, which meant 'completed' was treated as a live
// collider and could be offered as a sacrifice — writing 'removed' over a
// real completion.
function occupiesTime(i: DailyInstance): boolean {
  return i.status === "pending" || i.status === "active";
}

export function findRescheduleSlot(
  missedInstance: DailyInstance,
  allInstances: DailyInstance[],
  sleepTargetMinutes?: number | null,
  wakeTargetMinutes?: number | null
): { start_minutes: number; end_minutes: number } | null {
  const duration = missedInstance.end_minutes - missedInstance.start_minutes;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const bufferMinutes = nowMinutes + 30;

  const dayEnd = resolveDayEnd(sleepTargetMinutes, wakeTargetMinutes);

  const occupied = allInstances
    .filter((i) => i.id !== missedInstance.id && occupiesTime(i))
    .map((i) => ({ start: i.start_minutes, end: i.end_minutes }));

  const candidates = [bufferMinutes, ...occupied.map((o) => o.end)];

  for (const start of candidates) {
    if (start < bufferMinutes) continue;
    const end = start + duration;
    if (end > dayEnd) continue;

    const conflicts = occupied.some((o) => start < o.end && end > o.start);
    if (!conflicts) return { start_minutes: start, end_minutes: end };
  }

  return null;
}

export function findSlotCollisions(
  slot: { start_minutes: number; end_minutes: number },
  allInstances: DailyInstance[],
  excludeId: string
): string[] {
  return allInstances
    .filter(
      (i) =>
        i.id !== excludeId &&
        i.status !== "skipped" &&
        i.status !== "removed" &&
        i.status !== "rescheduled" &&
        slot.start_minutes < i.end_minutes &&
        slot.end_minutes > i.start_minutes
    )
    .map((i) => i.block?.name ?? "another block");
}

// A collision is a decision point, not a dead end. Blocking the reschedule
// produces the freeze; auto-cascading makes the app author the schedule.
// Push is the one bounded clean resolution — move the single blocking block
// to just after the new slot. Everything else that is not a fixed collider
// is an explicit sacrifice: the user names what gets dropped. Fixed is the
// only remaining refusal. No recursion by design.
export type DisplacementPlan =
  | { kind: "clear" }
  | { kind: "push"; target: DailyInstance; newStart: number; newEnd: number }
  | { kind: "sacrifice"; targets: DailyInstance[]; names: string[] }
  | { kind: "blocked"; reason: "fixed"; names: string[] };

function isFixedInstance(i: DailyInstance): boolean {
  return i.is_fixed || !!i.block?.is_fixed;
}

export function planDisplacement(
  slot: { start_minutes: number; end_minutes: number },
  allInstances: DailyInstance[],
  excludeId: string,
  sleepTargetMinutes?: number | null,
  wakeTargetMinutes?: number | null
): DisplacementPlan {
  const live = allInstances.filter(
    (i) => i.id !== excludeId && occupiesTime(i)
  );

  const colliders = live.filter(
    (i) => slot.start_minutes < i.end_minutes && slot.end_minutes > i.start_minutes
  );

  if (colliders.length === 0) return { kind: "clear" };

  const fixed = colliders.filter(isFixedInstance);
  if (fixed.length > 0) {
    return {
      kind: "blocked",
      reason: "fixed",
      names: fixed.map((i) => i.block?.name ?? "another block"),
    };
  }

  if (colliders.length === 1) {
    const target = colliders[0];
    if (!target) {
      return { kind: "clear" };
    }
    const newStart = slot.end_minutes;
    const newEnd = newStart + (target.end_minutes - target.start_minutes);

    const dayEnd = resolveDayEnd(sleepTargetMinutes, wakeTargetMinutes);
    if (newEnd <= dayEnd) {
      const cascade = live.filter(
        (i) =>
          i.id !== target.id && newStart < i.end_minutes && newEnd > i.start_minutes
      );
      if (cascade.length === 0) {
        return { kind: "push", target, newStart, newEnd };
      }
    }
  }

  return {
    kind: "sacrifice",
    targets: colliders,
    names: colliders.map((i) => i.block?.name ?? "another block"),
  };
}

export function getFallbackSlot(
  missedInstance: DailyInstance
): { start_minutes: number; end_minutes: number } {
  const duration = missedInstance.end_minutes - missedInstance.start_minutes;
  const now = new Date();
  const start = Math.min(
    now.getHours() * 60 + now.getMinutes() + 30,
    1440 - duration
  );
  return { start_minutes: start, end_minutes: start + duration };
}
