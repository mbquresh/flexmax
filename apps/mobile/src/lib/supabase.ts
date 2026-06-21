import { createClient } from "@supabase/supabase-js";
import { Database } from "../types/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});

/** Typed wrapper until we generate types from Supabase CLI. */
export async function generateDailyInstances(targetDate: string) {
  return supabase.rpc("generate_daily_instances", {
    target_date: targetDate,
  } as never);
}
