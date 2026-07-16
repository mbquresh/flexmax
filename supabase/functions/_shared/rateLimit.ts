import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LIMITS: Record<string, number> = {
  "onboarding-chat": 30,
  "extract-psychology-profile": 5,
  "generate-schedule-tips": 5,
  "missed-block-recovery": 15,
};

const WINDOW_MS = 60 * 60 * 1000;

export async function checkRateLimit(
  userId: string,
  functionName: string
): Promise<{ allowed: boolean; limit: number }> {
  const limit = LIMITS[functionName] ?? 10;

  // Service-role client: rate limit state must not be user-tamperable.
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // NOTE: toISOString() is CORRECT here. CLAUDE.md bans it for local calendar
  // dates (getLocalDateString). This is an absolute timestamptz instant, not a
  // date. Do not "fix" this.
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const { count, error } = await admin
    .from("ai_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("function_name", functionName)
    .gte("called_at", since);

  // Fail CLOSED. A persistent error means misconfiguration; we want it loud,
  // not silently running with no spend protection.
  if (error) {
    console.error("rateLimit check failed:", error);
    return { allowed: false, limit };
  }

  if ((count ?? 0) >= limit) return { allowed: false, limit };

  // Record BEFORE the AI call, not after — otherwise concurrent requests all
  // pass the check before any row lands.
  const { error: insertError } = await admin
    .from("ai_rate_limits")
    .insert({ user_id: userId, function_name: functionName });

  if (insertError) {
    console.error("rateLimit insert failed:", insertError);
    return { allowed: false, limit };
  }

  return { allowed: true, limit };
}
