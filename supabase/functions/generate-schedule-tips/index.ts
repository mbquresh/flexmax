/**
 * Edge Function: generate-schedule-tips
 *
 * Generates 3–4 coaching tips from the user's psychology profile (once),
 * saves them to psychology_profiles.schedule_tips, and returns them.
 *
 * Deploy: supabase functions deploy generate-schedule-tips
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateScheduleTips } from "../_shared/ai.ts";
import { corsHeaders, getAuthenticatedUser } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: profile, error: fetchError } = await supabase
      .from("psychology_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!profile?.completed_at) {
      return new Response(JSON.stringify({ error: "Onboarding not complete" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile.schedule_tips?.length) {
      return new Response(JSON.stringify({ tips: profile.schedule_tips }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tips, provider } = await generateScheduleTips(profile);

    const { error: updateError } = await supabase
      .from("psychology_profiles")
      .update({ schedule_tips: tips })
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ tips, provider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
