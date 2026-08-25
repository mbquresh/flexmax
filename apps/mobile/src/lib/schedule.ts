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

export function findRescheduleSlot(
  missedInstance: DailyInstance,
  allInstances: DailyInstance[],
  sleepTargetMinutes?: number | null
): { start_minutes: number; end_minutes: number } | null {
  const duration = missedInstance.end_minutes - missedInstance.start_minutes;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const bufferMinutes = nowMinutes + 30;

  // Day ends at bedtime, not midnight. Falls back to midnight only when the
  // user has no sleep target set.
  const dayEnd = sleepTargetMinutes ?? 1440;

  const occupied = allInstances
    .filter(
      (i) =>
        i.id !== missedInstance.id &&
        i.status !== "skipped" &&
        i.status !== "removed" &&
        i.status !== "rescheduled"
    )
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
// This names the conflict and offers ONE bounded resolution — push the single
// blocking block to just after the new slot — and refuses honestly in every
// case it cannot handle cleanly. No recursion by design.
export type DisplacementPlan =
  | { kind: "clear" }
  | {
      kind: "displace";
      instanceId: string;
      name: string;
      newStart: number;
      newEnd: number;
    }
  | {
      kind: "blocked";
      reason: "multiple" | "fixed" | "past_bedtime" | "cascade";
      names: string[];
    };

function isFixedInstance(i: DailyInstance): boolean {
  return i.is_fixed || !!i.block?.is_fixed;
}

function isLiveInstance(i: DailyInstance): boolean {
  return (
    i.status !== "skipped" && i.status !== "removed" && i.status !== "rescheduled"
  );
}

export function planDisplacement(
  slot: { start_minutes: number; end_minutes: number },
  allInstances: DailyInstance[],
  excludeId: string,
  sleepTargetMinutes?: number | null
): DisplacementPlan {
  const live = allInstances.filter(
    (i) => i.id !== excludeId && isLiveInstance(i)
  );

  const colliders = live.filter(
    (i) => slot.start_minutes < i.end_minutes && slot.end_minutes > i.start_minutes
  );

  if (colliders.length === 0) return { kind: "clear" };

  if (colliders.length > 1) {
    return {
      kind: "blocked",
      reason: "multiple",
      names: colliders.map((i) => i.block?.name ?? "another block"),
    };
  }

  const target = colliders[0];
  const name = target.block?.name ?? "another block";

  if (isFixedInstance(target)) {
    return { kind: "blocked", reason: "fixed", names: [name] };
  }

  const newStart = slot.end_minutes;
  const newEnd = newStart + (target.end_minutes - target.start_minutes);

  // Same day-end convention as findRescheduleSlot: bedtime when set, else midnight.
  const dayEnd = sleepTargetMinutes ?? 1440;
  if (newEnd > dayEnd) {
    return { kind: "blocked", reason: "past_bedtime", names: [name] };
  }

  const cascade = live.filter(
    (i) => i.id !== target.id && newStart < i.end_minutes && newEnd > i.start_minutes
  );

  if (cascade.length > 0) {
    return {
      kind: "blocked",
      reason: "cascade",
      names: cascade.map((i) => i.block?.name ?? "another block"),
    };
  }

  return { kind: "displace", instanceId: target.id, name, newStart, newEnd };
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

export const CATEGORY_OPTIONS: { value: BlockCategory; label: string }[] = [
  { value: "deep_work", label: "Deep work" },
  { value: "health", label: "Health" },
  { value: "morning_routine", label: "Morning" },
  { value: "wind_down", label: "Wind down" },
  { value: "learning", label: "Learning" },
  { value: "admin", label: "Admin" },
  { value: "other", label: "Other" },
];
