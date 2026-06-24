import { supabase } from "./supabase";
import { PsychologyProfile } from "../types/database";

export async function loadScheduleTips(
  psychologyProfile: PsychologyProfile | null
): Promise<string[]> {
  if (!psychologyProfile?.completed_at) return [];

  if (psychologyProfile.schedule_tips?.length) {
    return psychologyProfile.schedule_tips;
  }

  const { data, error } = await supabase.functions.invoke("generate-schedule-tips", {
    body: {},
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data.tips ?? [];
}
