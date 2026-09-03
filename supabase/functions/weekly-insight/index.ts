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
   This includes SCOPE as well as arithmetic. If your evidence supports a
   mechanism for SOME of a block's failures, cite that subset — never round it
   up to the block's total failures. "Post-fajr sleep cost this block 5 of its
   12 misses" and "cost this block 12 of 27 days" are different claims, and
   only one of them is in the payload.
2. OBEY data_quality.caveats in the payload. They are not advisory.
3. Never state a count without its denominator. "missed 6" is an accusation;
   "missed 6 of the last 14" is information.
4. Never present two statistics that pull in opposite directions. If the numbers
   disagree, say less.
   This applies ACROSS insights in the same set, not only within one. Two
   insights naming the same block in ways that appear to disagree — one calling
   it reliable, another calling it the source of a problem — read as the engine
   arguing with itself even when both are technically true. If two insights
   touch the same block, either make the relationship explicit in one of them or
   drop the weaker.
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
8. Quality drift describes the BLOCK's trajectory, never the user's effort.
   Say "this block has been landing at half strength", never "you have not
   been focused". The rating describes what happened in the block, not who
   the user is.
9. cannibalization is CORROBORATING evidence only. Never raise it as a
   standalone insight. Cite it only when the user's own reflections
   independently describe the same trade, and then as agreement between two
   sources — not as a discovery. The lift figures currently rest on very few
   events, and a pair with a high lift but no supporting reflection is more
   likely a scheduling artifact than a real trade.

   Specifically: a "sacrificed" block whose failures are mostly 'unaccounted'
   rather than 'missed' may indicate the user stopped logging that evening, not
   that the block was given up. Weight pairs where the sacrificed block is
   confirmed 'missed' far more heavily than ones where it was never checked in.
10. CHECK block_recency BEFORE describing any pattern as current. It carries
    completed_7d / failed_7d against completed_prior / failed_prior for every
    block. If a block's failures sit in failed_prior and are absent from
    failed_7d, that pattern has STOPPED. Describe it in the past tense as
    something the user has already changed, or omit it. Never write "this
    month", "lately", "recently", or a bare present tense about a pattern that
    does not appear in the last 7 days. Reporting a habit the user has already
    fixed proves you are not watching, and costs more trust than saying nothing.
11. A DIVERGENCE between the recent window and the prior one is the strongest
    thing in the payload. A block whose ratio has clearly moved — in either
    direction — outranks any flat 30-day total, because the user cannot see it
    themselves: a month of averages hides it, and living through it feels like
    noise. When any block shows a clear divergence, at least one insight MUST be
    about it. Improvement counts. A block that has turned around is a finding,
    not a compliment, and naming it is not cheerleading.
12. RESPECT block age. days_tracked and first_seen say how long a block has
    existed, not how it is going. For a block with few days_tracked relative to
    the 30-day window: you may state its record, but you may NOT diagnose it,
    call it broken, say it has no working slot, or prescribe restructuring the
    schedule around it. Say plainly that it is new and has not landed yet. The
    tracked filter admits any block with 3 resolved instances, so a low
    completion count on a young block is absence of evidence, not evidence of
    failure.

WHAT TO LOOK FOR, in priority order
- Direction of travel: block_recency divergence between the last 7 days and
  prior. A block that has clearly improved or clearly deteriorated is the
  highest-value thing you can report, because it is the one thing a 30-day
  average actively conceals.
- Causal chains ACROSS days or blocks (one thing displacing another).
- Quality drift: recent_poor vs recent_rated shows whether the sessions that
  DO happen are getting worse. Raise it when recent_poor is a majority of
  recent_rated. This applies whether the block is thriving or struggling:
  for a healthy block it is an early warning before misses begin; for a
  struggling block it means the sessions that survive are also degrading,
  which is a different and worse problem than frequency alone. Do NOT raise
  it when recent_poor is 0 or 1 — that is noise.
- nudge_outcomes and miss_reasons: cite only with 5+ events. Below that the
  numbers are noise. miss_reasons are tapped presets — report them as counts
  ("low energy on 6 of 9 misses"), never as something the user wrote.
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

const KINDS = new Set(["causal", "pattern", "strength"]);

function sanitizeInsights(raw: unknown): InsightPayload[] | null {
  if (!Array.isArray(raw)) return null;

  const out: InsightPayload[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.kind !== "string" || !KINDS.has(o.kind)) continue;
    if (typeof o.belief !== "string" || typeof o.evidence !== "string") continue;

    const related = Array.isArray(o.related_blocks)
      ? o.related_blocks.filter((n): n is string => typeof n === "string")
      : [];
    const suggestion =
      typeof o.suggestion === "string" && o.suggestion.length > 0
        ? o.suggestion.slice(0, 150)
        : null;
    const nudge_line =
      typeof o.nudge_line === "string" && o.nudge_line.length > 0
        ? o.nudge_line.slice(0, 80)
        : null;

    out.push({
      kind: o.kind,
      belief: o.belief.slice(0, 200),
      evidence: o.evidence.slice(0, 250),
      suggestion,
      related_blocks: related,
      nudge_line,
    });
  }

  return out.length > 0 ? out : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      console.error("[weekly-insight] 401 no authenticated user");
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
      console.log(`[weekly-insight] cache hit user=${user.id} count=${existing.length}`);
      return new Response(JSON.stringify({ insights: existing, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { allowed, limit } = await checkRateLimit(user.id, "weekly-insight");
    if (!allowed) {
      console.warn(`[weekly-insight] 429 rate limited user=${user.id}`);
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
      console.log(`[weekly-insight] insufficient data user=${user.id}`);
      return new Response(JSON.stringify({ insights: [], reason: "insufficient_data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("psychology_profiles")
      .select("accountability_tone")
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
            // firm | gentle | data-driven are the only values the system prompt is
            // written for, and the only ones the profile page can set. The fallback
            // must be one of them.
            content: `Accountability tone preference: ${profile?.accountability_tone ?? "firm"}
Evidence:
${JSON.stringify(evidence)}`,
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message ?? "Claude API failed");

    const raw = data.content?.[0]?.text ?? "[]";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch (parseErr) {
      console.error("[weekly-insight] 500 parse failure", parseErr);
      return new Response(JSON.stringify({ error: "Insight generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const insights = sanitizeInsights(parsed);
    if (!insights) {
      console.error("[weekly-insight] 500 AI response failed schema check");
      return new Response(JSON.stringify({ error: "Insight generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inserted, error: replaceError } = await supabase.rpc(
      "replace_behavioral_insights",
      {
        p_user_id: user.id,
        p_insights: insights,
      }
    );

    if (replaceError) throw replaceError;

    console.log(`[weekly-insight] generated user=${user.id} count=${inserted?.length ?? 0}`);
    return new Response(JSON.stringify({ insights: inserted, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Detail goes to the logs, never to the client. Returning String(err)
    // leaked internal error text — see Known issues.
    console.error("[weekly-insight] 500 unhandled", err);
    return new Response(
      JSON.stringify({ error: "Insight generation failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
