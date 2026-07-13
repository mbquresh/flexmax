/**
 * Edge Function: nightly-notify
 *
 * Runs nightly (via pg_cron or Supabase scheduled function).
 * Sends "set up tomorrow" push to all users with registered tokens.
 * Tomorrow's instances are generated client-side when the user opens
 * Plan Tomorrow or Today — not here.
 *
 * Deploy: supabase functions deploy nightly-notify
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function verifyCronSecret(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!verifyCronSecret(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("token, user_id");

  if (!tokens?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const messages = tokens.map((t) => ({
    to: t.token,
    title: "Tonight: set up tomorrow",
    body: "Take 2 minutes to fill in what you'll actually do in each block. It makes the difference.",
    data: { type: "nightly_fill" },
    sound: "default",
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });

  const result = await response.json();

  return new Response(JSON.stringify({ sent: messages.length, result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
