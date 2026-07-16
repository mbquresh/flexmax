/**
 * Edge Function: extract-psychology-profile
 *
 * After onboarding completes, extracts structured psychology profile
 * from the conversation transcript and saves to Supabase.
 *
 * Deploy: supabase functions deploy extract-psychology-profile
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractPsychologyProfile } from "../_shared/ai.ts";
import { PROFILE_EXTRACTION_PROMPT } from "../_shared/prompts.ts";
import { corsHeaders, getAuthenticatedUser } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

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
    const { data: existing } = await supabase
      .from("psychology_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.completed_at) {
      return new Response(JSON.stringify({ profile: existing, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    const { allowed, limit } = await checkRateLimit(user.id, "extract-psychology-profile");
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: `Rate limit exceeded. Max ${limit} requests per hour.`,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": "3600",
          },
        }
      );
    }

    const { profile, provider } = await extractPsychologyProfile(
      messages,
      PROFILE_EXTRACTION_PROMPT
    );

    const { data: saved, error } = await supabase
      .from("psychology_profiles")
      .upsert(
        {
          user_id: user.id,
          onboarding_messages: messages,
          peak_energy_times: profile.peak_energy_times ?? null,
          avoidance_patterns: profile.avoidance_patterns ?? null,
          motivation_style: profile.motivation_style ?? null,
          sabotage_triggers: profile.sabotage_triggers ?? null,
          goals: profile.goals ?? null,
          accountability_tone: profile.accountability_tone ?? null,
          raw_ai_summary: profile.raw_ai_summary ?? null,
          completed_at: new Date().toISOString(),
          schedule_tips: null,
        },
        {
          onConflict: "user_id",
        }
      )
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ profile: saved, provider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : typeof err === "object"
        ? JSON.stringify(err)
        : String(err);

    console.error("Extract error:", errorMessage, err);

    return new Response(
      JSON.stringify({ error: errorMessage, stack: err instanceof Error ? err.stack : undefined }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
