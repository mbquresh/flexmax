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
   Never add block_recency fields together. completed_7d + failed_7d is not
   in the payload, and neither is completed_prior + failed_prior. Cite each
   as it appears: "completed 5 and failed 2 in the last 7, against completed
   8 and failed 13 prior."
   Never turn a percent into a count. If you want "X of Y", both X and Y
   must already be counts in the payload.
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
   A long-window keystone and a 7-day turnaround on the same block are one
   story, not two verdicts. If both survive, the second sentence must name
   the first — the dependency still holds; the earlier block is failing
   less. Otherwise drop the weaker.
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
9. block_coupling describes how one block's outcome relates to a later
   block's outcome on the same day. Read the sign:

   relation = 'keystone': the earlier block FAILING predicts the later one
     failing. pct_when_lost is much higher than pct_when_won. Frame as
     structural dependency — the later block relies on the earlier one
     holding. This is the most valuable finding available to you and you
     may raise it as a standalone insight when it qualifies below.

   relation = 'cannibalization': the earlier block COMPLETING predicts the
     later one failing. The earlier block takes the later one's time.
     Rarer. Same qualification rules.

   You may lead with a coupling finding ONLY when all of:
     - persistence is 'confirmed'
     - abs(day_baseline_shift) is less than half of abs(lift)
     - later_unaccounted_days is under half of the failures involved

   If persistence is 'single_window', you may state it but must say the
   window is short and it has not yet been seen to repeat.
   If persistence is 'contradicted', do not raise it at all.
   If day_baseline_shift approaches lift, the whole day moved, not this
   pair — describe it as a day-level pattern or omit it.

   Never say "causes". Say "predicts", "goes with", "has gone with".
   Cite both arms as counts that already exist:
   "n_won_later_failed of n_won days" when the earlier block completed,
   "n_lost_later_failed of n_lost days" when it did not.
   Do not write pct_when_won, pct_when_lost, or any percentage for a
   coupling arm. Do not write lift, persistence, day_baseline_shift, or
   any other payload key name in belief, evidence, or nudge_line. Those
   fields are for qualification, not for the user.

   keystones names earlier blocks with two or more coupling relations,
   including rows that do not meet the lead-with bar. Treat it as a label
   on the pairs, not a second computation. Raise a "the day hangs on X"
   sentence only when at least one of X's pairs meets the lead-with bar.
   Do not raise a keystones name whose pairs are all contradicted or
   whole-day collapse. kind for a qualifying keystone or weekday finding
   is "structural".
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
13. insight_corrections is a list of beliefs the user rejected, in their own
    words. A belief_snapshot in that list must not return in the same form.
    Address the note or drop the claim. Do not argue with the user in the
    belief text. Do not quote the correction as a confession or as evidence
    they were wrong.
14. day_of_week is fail rate by weekday over the 30-day base. Report a
    weekday pattern only when the spread between the best and worst day
    exceeds 15 points and each of those two days has at least 8 relevant
    instances. Describe the day, never the person. Cite each day's
    fail_pct and relevant from the payload; do not invent a third number
    for the gap. kind is "structural".

WHAT TO LOOK FOR, in priority order
- Direction of travel: block_recency divergence between the last 7 days and
  prior. A block that has clearly improved or clearly deteriorated is the
  highest-value thing you can report, because it is the one thing a 30-day
  average actively conceals.
- Structural dependency: a qualifying keystone in block_coupling (rule 9),
  or a weekday spread that clears rule 14. These are discoveries — they do
  not need a matching reflection. kind "structural".
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
- suggestion is optional and usually null. A qualifying keystone does not
  need one. Never invent a time, a "fallback slot", or a schedule the
  payload does not contain. If you cannot name a change using only
  payload facts, set suggestion to null. Never "try harder" or "be consistent".
- belief, evidence, and nudge_line are user-facing. Never write JSON keys,
  SQL names, or operator values (persistence=confirmed, lift=-58,
  block_coupling, day_baseline_shift, block_stats). Translate or omit.
- Be truthful about a bad stretch. Do not hide it, do not moralise about it.
  Name the mechanism.

OUTPUT
Return ONLY a JSON array of 2-3 objects, no markdown, no preamble:

[
  {
    "kind": "causal" | "pattern" | "strength" | "structural",
    "belief": "one sentence, max 200 characters",
    "evidence": "the specific numbers and quotes behind it, max 250 characters",
    "suggestion": "one small structural change using only payload facts, max 150 characters, or null",
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

const KINDS = new Set(["causal", "pattern", "strength", "structural"]);

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

const COUPLING_RELATIONS = new Set(["keystone", "cannibalization"]);

function asInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  return null;
}

function sanitizeCoupling(
  userId: string,
  evidence: unknown
): Record<string, unknown>[] {
  if (!evidence || typeof evidence !== "object") return [];
  const raw = (evidence as { block_coupling?: unknown }).block_coupling;
  if (!Array.isArray(raw)) return [];

  const out: Record<string, unknown>[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const triggerId = typeof o.trigger_id === "string" ? o.trigger_id : null;
    const laterId = typeof o.later_id === "string" ? o.later_id : null;
    const relation = typeof o.relation === "string" ? o.relation : null;
    const persistence = typeof o.persistence === "string" ? o.persistence : null;
    const lift = asInt(o.lift);
    const pctWhenWon = asInt(o.pct_when_won);
    const pctWhenLost = asInt(o.pct_when_lost);
    const days = asInt(o.days);
    const nWon = asInt(o.n_won);
    const nLost = asInt(o.n_lost);
    if (
      !triggerId ||
      !laterId ||
      !relation ||
      !COUPLING_RELATIONS.has(relation) ||
      !persistence ||
      lift == null ||
      pctWhenWon == null ||
      pctWhenLost == null ||
      days == null ||
      nWon == null ||
      nLost == null
    ) {
      continue;
    }
    out.push({
      user_id: userId,
      trigger_block_id: triggerId,
      later_block_id: laterId,
      relation,
      lift,
      pct_when_won: pctWhenWon,
      pct_when_lost: pctWhenLost,
      days,
      n_won: nWon,
      n_lost: nLost,
      persistence,
      computed_at: new Date().toISOString(),
    });
  }
  return out;
}

async function persistBlockCoupling(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  evidence: unknown
): Promise<void> {
  try {
    const rows = sanitizeCoupling(userId, evidence);
    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("block_coupling")
        .upsert(rows, { onConflict: "user_id,trigger_block_id,later_block_id" });
      if (upsertError) throw upsertError;
    }

    const { data: existing, error: readError } = await supabase
      .from("block_coupling")
      .select("trigger_block_id, later_block_id")
      .eq("user_id", userId);
    if (readError) throw readError;

    const keep = new Set(
      rows.map((r) => `${r.trigger_block_id}:${r.later_block_id}`)
    );
    const stale = (existing ?? []).filter(
      (e) => !keep.has(`${e.trigger_block_id}:${e.later_block_id}`)
    );
    for (const row of stale) {
      const { error: delError } = await supabase
        .from("block_coupling")
        .delete()
        .eq("user_id", userId)
        .eq("trigger_block_id", row.trigger_block_id)
        .eq("later_block_id", row.later_block_id);
      if (delError) throw delError;
    }
    console.log(
      `[weekly-insight] coupling upserted user=${userId} rows=${rows.length} stale=${stale.length}`
    );
  } catch (err) {
    console.error("[weekly-insight] coupling write failed", err);
  }
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

    const { data: corrections, error: correctionsError } = await supabase
      .from("insight_corrections")
      .select("belief_snapshot, note, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (correctionsError) throw correctionsError;

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
${JSON.stringify(evidence)}
Corrections (beliefs the user rejected — do not restate):
${JSON.stringify(corrections ?? [])}`,
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

    await persistBlockCoupling(supabase, user.id, evidence);

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
