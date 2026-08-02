/**
 * Edge Function: weekly-insight
 *
 * One AI call per user per week: turns get_behavior_evidence() into stored
 * behavioral_insights. Cache hit returns existing rows with no AI spend.
 *
 * Deploy: supabase functions deploy weekly-insight
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getAuthenticatedUser } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You are FlexMax's behavioral analyst. You receive PRECOMPUTED statistics about
one user's last 30 days, plus their own written reflections.

Your job is to name the MECHANISM behind what is happening and cite the evidence.
You are not a coach, not a cheerleader, and not a therapist.

ABSOLUTE RULES

1. NEVER compute anything. Every number you use must appear verbatim in the
   payload. Do not add, average, convert, or infer figures.
2. OBEY data_quality.caveats in the payload. They are not advisory.
3. Never state a count without its denominator. "missed 6" is an accusation;
   "missed 6 of the last 14" is information.
4. Never present two statistics that pull in opposite directions. If the numbers
   disagree, say less.
5. Prefer insights CORROBORATED by two independent sources — e.g. the user's
   reflections say one thing and swap_drift independently shows it. Single-source
   patterns are weaker; say so or omit them.
6. Superlative and comparative claims ("the strongest", "the most consistent",
   "better than", "your best") may ONLY consider blocks with total >= 10
   occurrences. Blocks with fewer occurrences carry too little data to rank, and
   citing one inside a comparison will contradict your own point. You may still
   mention a low-occurrence block on its own — just never as part of a ranking.
7. The evidence field must SUPPORT its belief. Before returning, re-read each
   belief/evidence pair and check that every number in the evidence strengthens
   the claim rather than undercutting it. If any number argues against the
   belief it accompanies, rewrite one or drop the other.

WHAT TO LOOK FOR, in priority order
- Causal chains ACROSS days or blocks (one thing displacing another).
- Patterns the user has stated themselves in reflections. Their own words are
  the highest-signal data you have — quote them.
- Genuine strengths, evidence-backed.

TONE — these are product-critical
- Name STRUCTURAL causes: a mechanism, a sequence, a missing boundary, a slot in
  the wrong place. NEVER character causes.
- Never echo the user's self-blaming vocabulary back at them. Reflections may
  contain words like "sloth", "bad day", "unconsciousness". Do not repeat them.
- Never use: lazy, failure, discipline, "should have", willpower, "don't beat
  yourself up".
- Never reassure about a judgment you are not making. Do not write "not a
  verdict" or "no judgment here" — denying a judgment implies one was available.
- A deliberate trade is NOT a failure. If a reflection says a miss was worth it,
  treat it as a choice the user stands by, not a problem to solve.
- With small numbers, state the actual fraction ("4 of your last 5"), never a
  percentage.
- At most ONE suggestion per insight, and it must be a small structural change —
  moving a block, adding a boundary — never "try harder" or "be consistent".
- Be truthful about a bad stretch. Do not hide it, do not moralise about it.
  Name the mechanism.

OUTPUT
Return ONLY a JSON array of 2-3 objects, no markdown, no preamble:

[
  {
    "kind": "causal" | "pattern" | "strength",
    "belief": "one sentence, max 200 characters",
    "evidence": "the specific numbers and quotes behind it, max 250 characters",
    "suggestion": "one small structural change, max 150 characters, or null",
    "related_blocks": ["exact block names from the payload this concerns"],
    "nudge_line": "max 80 characters, or null"
  }
]

- nudge_line is shown inside a phone notification 30 minutes before a block ends.
  It must be readable at a glance on a lock screen.
- It states the DOWNSTREAM COST of this block running over, in the fewest words
  that stay true. Example shape: "late finishes here have cost you the morning
  8 times this month".
- It must contain only numbers that appear in the payload. Same rule as
  everything else: never compute.
- Lowercase start is fine — it is appended after "Ends at 8:30. "
- No imperatives. Do not tell the user to stop, wrap up, or hurry. State the
  cost; the decision is theirs.
- Set it to null for "strength" insights and for any insight with no clear
  downstream cost. Null is correct and common — a nudge without a why is still
  a useful nudge.

At least one object MUST have kind "strength" and must be genuine — supported by
real evidence, not consolation. related_blocks must use block names exactly as
they appear in the payload; use an empty array if an insight is not block-specific.`;

type InsightPayload = {
  kind: string;
  belief: string;
  evidence: string;
  suggestion: string | null;
  related_blocks: string[];
  nudge_line: string | null;
};

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

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing, error: cacheError } = await supabase
      .from("behavioral_insights")
      .select("*")
      .eq("user_id", user.id)
      .eq("superseded", false)
      .gt("generated_at", sevenDaysAgo)
      .order("rank");

    if (cacheError) throw cacheError;

    if (existing?.length) {
      return new Response(JSON.stringify({ insights: existing, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { allowed, limit } = await checkRateLimit(user.id, "weekly-insight");
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

    const { data: evidence, error: evidenceError } = await supabase.rpc(
      "get_behavior_evidence",
      { p_user_id: user.id }
    );
    if (evidenceError) throw evidenceError;

    if (!evidence || evidence.data_quality?.engaged_days < 5) {
      return new Response(JSON.stringify({ insights: [], reason: "insufficient_data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("psychology_profiles")
      .select("raw_ai_summary, accountability_tone")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Accountability tone preference: ${profile?.accountability_tone ?? "direct"}
Evidence:
${JSON.stringify(evidence)}`,
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message ?? "Claude API failed");

    const raw = data.content?.[0]?.text ?? "[]";
    let parsed: InsightPayload[];

    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch (parseErr) {
      return new Response(JSON.stringify({ error: String(parseErr) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(parsed)) {
      return new Response(JSON.stringify({ error: "AI response was not a JSON array" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: supersedeError } = await supabase
      .from("behavioral_insights")
      .update({ superseded: true })
      .eq("user_id", user.id)
      .eq("superseded", false);

    if (supersedeError) throw supersedeError;

    const rows = parsed.map((item, i) => ({
      user_id: user.id,
      kind: item.kind,
      belief: item.belief,
      evidence: item.evidence,
      suggestion: item.suggestion ?? null,
      related_blocks: item.related_blocks ?? [],
      nudge_line: item.nudge_line ?? null,
      rank: i + 1,
      superseded: false,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("behavioral_insights")
      .insert(rows)
      .select("*")
      .order("rank");

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ insights: inserted, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
