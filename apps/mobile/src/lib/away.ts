import { supabase } from "./supabase";
import { getLocalDateString } from "./time";
import { AwayPeriod } from "../types/database";
import { handleError } from "./errors";

export function formatAwayRange(p: AwayPeriod): string {
  const fmt = (iso: string) => {
    // Parse as LOCAL. new Date("2026-09-04") is UTC midnight and renders
    // as the previous day in any negative-offset timezone.
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };
  return p.starts_on === p.ends_on
    ? fmt(p.starts_on)
    : `${fmt(p.starts_on)} – ${fmt(p.ends_on)}`;
}

export function isCurrent(p: AwayPeriod): boolean {
  const today = getLocalDateString();
  return p.starts_on <= today && today <= p.ends_on;
}

export async function createAwayPeriod(
  userId: string,
  startsOn: string,
  endsOn: string,
  label: string | null
): Promise<AwayPeriod> {
  const { data, error } = await supabase
    .from("away_periods")
    .insert({ user_id: userId, starts_on: startsOn, ends_on: endsOn, label })
    .select()
    .single();
  if (error) throw error;

  // Generation only prevents FUTURE instances. If the range covers today,
  // today's rows already exist and must be cleared, or the user marks
  // themselves away and the day stays full. Mark 'removed' rather than
  // deleting: 'removed' is already excluded from every live-instance
  // filter and from the evidence pack, and deleting would cascade
  // instance_time_changes.
  const today = getLocalDateString();
  if (startsOn <= today && today <= endsOn) {
    await supabase
      .from("daily_schedule_instances")
      .update({ status: "removed" })
      .eq("user_id", userId)
      .eq("date", today)
      .eq("status", "pending");
  }
  return data;
}

export async function deleteAwayPeriod(
  period: AwayPeriod,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("away_periods")
    .delete()
    .eq("id", period.id);
  if (error) throw error;

  const today = getLocalDateString();
  if (period.starts_on > today || period.ends_on < today) return;

  // Generate first: covers a period created on an earlier day, where
  // today's generation already ran with the period in place and no rows
  // exist at all. It is a no-op where rows already exist.
  const { error: genErr } = await supabase.rpc("generate_my_daily_instances", {
    target_date: today,
  });
  if (genErr) handleError(genErr, "awayRestoreGenerate");

  // Then clear the tombstones left by createAwayPeriod. Scoped to today
  // and to 'removed' so nothing historical is touched.
  const { error: instErr } = await supabase
    .from("daily_schedule_instances")
    .update({ status: "pending" })
    .eq("user_id", userId)
    .eq("date", today)
    .eq("status", "removed");
  if (instErr) handleError(instErr, "awayRestoreClearRemoved");
}
