import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Database } from "../types/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Data writes: perceived responsiveness matters more than tolerating a
// slow network — offline taps should fall through to the write queue fast.
const DATA_TIMEOUT_MS = 5_000;

// Auth: token refresh runs on cold start and BLOCKS app render. A timeout
// here does not degrade gracefully, it prevents the app from opening.
const AUTH_TIMEOUT_MS = 20_000;

const fetchWithTimeout: typeof fetch = (input, init) => {
  const url = typeof input === "string" ? input : input.toString();
  const isAuth = url.includes("/auth/v1/");
  const timeout = isAuth ? AUTH_TIMEOUT_MS : DATA_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  if (init?.signal) {
    if (init.signal.aborted) {
      clearTimeout(timeoutId);
      controller.abort();
    } else {
      init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});

/** Typed wrapper until we generate types from Supabase CLI. */
export async function generateDailyInstances(targetDate: string) {
  const { error } = await supabase.rpc("generate_my_daily_instances", {
    target_date: targetDate,
  });
  if (error) throw error;
}
