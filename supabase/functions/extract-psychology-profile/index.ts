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
import { corsHeaders, getAuthenticatedUser } from "../_shared/auth.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EXTRACTION_PROMPT = `
Analyze this FlexMax onboarding conversation and extract a structured psychology profile.
Return ONLY valid JSON, no markdown, no explanation.

Schema:
{
  "peak_energy_times": string[],
  "avoidance_patterns": string[],
  "motivation_style": "intrinsic" | "accountability" | "streaks" | "external",
  "sabotage_triggers": string[],
  "goals": string[],
  "accountability_tone": "firm" | "gentle" | "data-driven",
  "raw_ai_summary": string
}

Conversation:
`;

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

    const { messages } = await req.json();

    const transcript = messages
      .map((m: { role: string; content: string }) =>
        `${m.role === "user" ? "User" : "AI"}: ${m.content}`
      )
      .join("\n\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        messages: [{ role: "user", content: EXTRACTION_PROMPT + transcript }],
      }),
    });

    const data = await response.json();
    const raw = data.content?.[0]?.text ?? "{}";
    const profile = JSON.parse(raw.replace(/```json|```/g, "").trim());

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: saved, error } = await supabase
      .from("psychology_profiles")
      .upsert({
        user_id: user.id,
        onboarding_messages: messages,
        ...profile,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ profile: saved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
