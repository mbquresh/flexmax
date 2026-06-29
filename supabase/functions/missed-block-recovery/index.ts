import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, getAuthenticatedUser } from "../_shared/auth.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const SYSTEM_PROMPT = `
You are the missed block recovery AI for FlexMax.
A user missed a scheduled block. Respond with a JSON object:
{
  "acknowledgment": string,  // 1-2 sentences, warm, no blame, no generic phrases. Reference the specific block name and their psychology profile if available.
  "reflection_prompt_why": string,  // one short question: what got in the way?
  "reflection_prompt_improve": string,  // one short question: one thing to change next time?
  "pattern_note": string | null  // if miss_count >= 3, name the pattern directly. Otherwise null.
}
Return ONLY valid JSON. No markdown.
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
        max_tokens: 400,
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
