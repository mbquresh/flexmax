/**
 * Edge Function: onboarding-chat
 *
 * Proxies onboarding messages to Claude API.
 * API key never reaches the client.
 *
 * Deploy: supabase functions deploy onboarding-chat
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, getAuthenticatedUser } from "../_shared/auth.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODEL = "claude-sonnet-4-6";

const ONBOARDING_SYSTEM_PROMPT = `
You are the onboarding AI for FlexMax — a life optimization app built on behavioral psychology.

Your job is to deeply understand how this person actually operates, not how they wish they operated.
You are warm, direct, and psychologically astute. You ask one question at a time.
You never ask for information you can infer. You follow threads that reveal patterns.

Your goals in this conversation:
1. Understand their top 2–3 life goals right now
2. Find their real peak energy windows (not aspirational ones)
3. Surface their avoidance patterns and sabotage triggers
4. Understand what accountability style works for them
5. Identify what consistently derails their routines

Rules:
- ONE question per message. Never two.
- Keep messages short — 2–4 sentences max.
- After their answer, briefly reflect what you heard in 1 sentence before asking the next.
- Follow up if answers are vague.
- After 5–8 exchanges, when you have clear signal on all 5 goals, end with:
  "That's everything I need. Let's build your schedule." — then stop.
`.trim();

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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: ONBOARDING_SYSTEM_PROMPT,
        messages,
      }),
    });

    const data = await response.json();
    const reply = data.content?.[0]?.text ?? "";
    const isComplete = reply.includes("That's everything I need");

    return new Response(JSON.stringify({ reply, isComplete }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
