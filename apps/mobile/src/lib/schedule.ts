import { supabase } from "./supabase";
import { BlockCategory, DailyInstance, ScheduleBlock } from "../types/database";
import { timeToMinutes } from "./time";

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
  startTime: string;
  endTime: string;
  sortOrder: number;
  daysOfWeek?: number[];
}): Promise<ScheduleBlock> {
  const start_minutes = timeToMinutes(params.startTime);
  const end_minutes = timeToMinutes(params.endTime);

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
    startTime: "6:00 AM",
    endTime: "7:00 AM",
  },
  {
    name: "Deep work",
    category: "deep_work" as BlockCategory,
    startTime: "9:00 AM",
    endTime: "12:00 PM",
  },
  {
    name: "Workout",
    category: "health" as BlockCategory,
    startTime: "6:00 PM",
    endTime: "7:00 PM",
  },
  {
    name: "Wind down",
    category: "wind_down" as BlockCategory,
    startTime: "9:30 PM",
    endTime: "10:30 PM",
  },
];

export function findRescheduleSlot(
  missedInstance: DailyInstance,
  allInstances: DailyInstance[]
): { start_minutes: number; end_minutes: number } | null {
  const duration = missedInstance.end_minutes - missedInstance.start_minutes;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const bufferMinutes = nowMinutes + 30;

  const occupied = allInstances
    .filter((i) => i.id !== missedInstance.id && i.status !== "skipped")
    .map((i) => ({ start: i.start_minutes, end: i.end_minutes }))
    .sort((a, b) => a.start - b.start);

  const candidates = [bufferMinutes, ...occupied.map((o) => o.end)];

  for (const start of candidates) {
    if (start < bufferMinutes) continue;
    const end = start + duration;
    if (end > 1440) continue;

    const conflicts = occupied.some((o) => start < o.end && end > o.start);
    if (!conflicts) return { start_minutes: start, end_minutes: end };
  }

  return null;
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
