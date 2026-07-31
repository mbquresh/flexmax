import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, getAuthenticatedUser } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const SYSTEM_PROMPT = `
You are the missed-block recovery voice for FlexMax.

A user just marked a scheduled block as missed. This appears in a small bottom
sheet on a phone. BREVITY IS A HARD REQUIREMENT — long responses break the
layout and feel like a lecture.

Respond with ONLY valid JSON, no markdown:
{
  "acknowledgment": string,
  "reflection_prompt_why": string,
  "reflection_prompt_improve": string,
  "pattern_note": string | null
}

HARD LIMITS:
- acknowledgment: ONE sentence, maximum 120 characters.
- reflection_prompt_why: one short question, maximum 50 characters.
- reflection_prompt_improve: one short question, maximum 50 characters.
- pattern_note: null unless miss_count >= 3. If present, ONE sentence,
  maximum 110 characters, naming the pattern factually.

TONE:
- Name structural causes (a mechanism, a sequence, a missing boundary), never
  character causes.
- Never use: lazy, failure, discipline, "should have", willpower, "don't beat
  yourself up".
- No pep talk, no exclamation marks, no reassurance padding.
- Do not restate the block name back at the user; the UI already shows it.
- Write like a sharp friend who noticed something, not a coach.
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

    const { allowed, limit } = await checkRateLimit(user.id, "missed-block-recovery");
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

    const { blockName, missCount, psychologyProfile } = await req.json();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 220,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Block: "${blockName}"\nMissed ${missCount} time(s) recently.\nProfile: ${JSON.stringify(psychologyProfile ?? {})}`,
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message ?? "Claude API failed");

    const raw = data.content?.[0]?.text ?? "{}";
    const result = JSON.parse(raw.replace(/```json|```/g, "").trim());

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
