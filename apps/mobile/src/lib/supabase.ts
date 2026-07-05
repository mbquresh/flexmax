import { createClient } from "@supabase/supabase-js";
import { Database } from "../types/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

/** Typed wrapper until we generate types from Supabase CLI. */
export async function generateDailyInstances(targetDate: string) {
  const { error } = await supabase.rpc("generate_my_daily_instances", {
    target_date: targetDate,
  });
  if (error) throw error;
}
