[Back to the README](../README.md)

# The behavioral learning engine (v2b)

## Design principle

**SQL computes. Claude narrates. Nothing learns in the dark.**

All arithmetic — counts, rates, trends, correlations — happens in Postgres,
where it is exact and auditable. The LLM receives only finished numbers and the
user's own verbatim words, and its single job is to name the causal story and
cite the evidence. It never calculates, never invents a statistic, and never
decides strategy.

One AI call per user per week. Everything else is free injection of stored
results.

## Architecture

    daily_schedule_instances ──┐
    instance_time_changes ─────┼──> get_behavior_evidence(user_id)  [SQL]
    schedule_blocks ───────────┘              │
                                              ▼
                                     weekly-insight  [edge fn, 1 AI call/wk]
                                              │
                                              ▼
                                    behavioral_insights  [stored beliefs]
                                              │
                            ┌─────────────────┴─────────────────┐
                            ▼                                   ▼
                    Today morning card                     Weekly recap
                     (injected, free)                    (injected, free)

## Data integrity rules (learned the hard way)

These are non-negotiable. Each one was discovered by building the wrong thing
first and getting a confidently false answer.

1. **`start_minutes` / `end_minutes` are SCHEDULED template times, not
   behavioral records.** Blocks are recurring, so a "Sleep" block ending at
   23:00 reports 23:00 every night regardless of when the user actually slept.
   An early causal design self-joined on `end_minutes` to correlate late
   evenings with missed mornings; it returned the identical value on all 40+
   rows, because it was reading the plan, not the behavior. **Never generate a
   claim of the form "your deep work ran until 1am" from these columns.**

2. **`unaccounted` is disengagement signal, not a confirmed miss.** Nothing in
   the app auto-transitions stale blocks, so a block the user never
   acknowledged used to sit in `pending` forever. Migration 012 sweeps past-date
   `pending`/`active` rows to `unaccounted`. This is deliberately distinct from
   `missed` (which means the user engaged and marked it). Silence is data — but
   weaker data, and must be described as "never checked in", never as "you
   failed this".

3. **Blocks the user does not track regularly are excluded.** The filter
   requires at least 3 check-ins AND check-ins on at least 25% of instances.
   An earlier version required only a single check-in ever — which let "Sleep"
   through (completed once by accident out of 26) and ranked it the user's
   single largest failure at 24/26. Nobody checks off sleep. The filter is
   behavioral, not a hardcoded name list.

4. **All-unaccounted days are excluded.** Instances are generated on demand, so
   opening Plan Tomorrow mints a full day of blocks. During development this
   produced ~76% unaccounted rows across all history. A naive read would
   conclude "this user abandons three quarters of their commitments" — both
   false and exactly the shame-mirror the ICP quits apps over. A day counts only
   if it contains at least one real check-in.

5. **The caveats travel with the payload.** `data_quality.caveats` is shipped
   inside the evidence JSON so the narrator prompt cannot drift away from what
   the data actually supports.

6. **Never trend from a partial period or a single block type.** An early
   insight draft claimed a four-day winning streak based on morning blocks
   completing. Whole-day data showed two of those four days were 1-of-8
   collapses, and the most recent complete week was in fact the worst of the
   month. Trends come from `weekly_trend` and `day_shape`, complete periods only.
   Today is excluded from the evidence pack entirely.

## The streak measures accounting. The squares show both.

A completion-based streak breaks on the first bad day. For the user this product
is built for — someone who has abandoned every planner that made them feel like
a failure — that is precisely the uninstall moment. Optimizing for an unbroken
completion record means optimizing for the exact fragility the product exists to
solve.

So the protected number is **accounting, not completion**. A day counts toward
the streak when at least 80% of its blocks have a real, user-set status. Marking
something missed keeps the streak alive; only silence (`unaccounted`) breaks it.

The schema already made this distinction for other reasons: `missed` means the
user engaged and admitted it, `unaccounted` means no acknowledgement at all.
Single-user data showed the gap plainly — one block had 14 misses and 1
unaccounted (reported almost every time, including failures), while another had
6 misses and 15 unaccounted (silently abandoned). The same completion rate would
have described both. Confronting a miss is accountability. Silence is the drift.

**The visual encoding took three attempts.** Filling each square by the
accounting ratio made a fully-missed day look identical to a fully-completed one
— awarding visual credit for work that never happened. Adding an outline for
"accounted" fixed the honesty problem but gave closing out no felt payoff. The
shipped version is a stacked two-tone fill, bottom to top:

- **Teal segment** — completed
- **Neutral segment** — missed (accounted for, didn't happen)
- **Empty remainder** — unanswered

A fully-accounted day fills the square completely regardless of outcome, so
closing out is visibly rewarded. The teal-vs-neutral split keeps achievement and
honesty legible as separate things. The missed segment is deliberately NOT coral:
coral is the destructive color, and a week of coral squares reads as a wall of
errors — the exact shame signal this product exists to avoid.

Completion rate still exists and is still shown. It is information the engine
works with, not the thing the user is asked to protect.

## The highest-signal data is text, not timestamps

`reflection_why` is the most valuable column in the
database. Users narrate their own causality in plain language, which no
inference layer needs to reconstruct. In one month of single-user data, 29
reflections contained two distinct causal chains sharing a single root cause,
stated explicitly and repeatedly by the user.

This inverted the architecture: the evidence pack is **text-first**, with
statistics as supporting context — not statistics-first with text as colour.

A direct consequence: whatever the reflection UI does to encourage or discourage
filling in these fields has more impact on product quality than any modelling
work. Protect that input path.

`reflection_improve` was a second free-text field asking what the user
would change next time. It was removed. Adding presets to lift its fill
rate turned it into six repeated strings, and a canned forward-looking
intention is not evidence of anything — the chip is easier than the
thought. The column and its history remain; nothing collects into it. This
is the sharpest form of the point above: what the reflection UI does to
that input path matters more than any modelling work, in both directions.

## Corroboration across independent sources

An insight is trustworthy when two unrelated data sources agree. Example from
real data: the user's reflections describe oversleeping pushing the
morning deep work block later, which then displaces everything after it.
Independently, `swap_drift` shows Cardio moved later in 7 of 7 moves at an
average of five hours, and Morning Deep Work later in 6 of 6 at four and a
half. The text says it; the audit trail shows it, and the displacement is
perfectly unidirectional in both.

This example is itself a cautionary tale. The original version of this
paragraph cited swap counts of 13, 9 and 10 against Morning Deep Work's 2 —
figures produced by counting every logged time change rather than net
movement. A swap writes two rows and swapping back writes two more, so
net-zero fiddling read as heavy drift. An audit found 817 logged changes
resolving to 45 real moves: 5.5% signal. Migration 027 replaced the metric
with net displacement per instance, and the ordering the original claim
rested on reversed. Corroboration is only worth something when both sources
are measuring what you think they are.

## Engagement asymmetry is a signal in its own right

The ratio of `missed` to `unaccounted` per block reveals which commitments the
user still treats as real. Real example: Fajr+Quran shows 14 missed and 1
unaccounted — the user reports on it almost every time, including failures.
Weights workout shows 6 missed and 15 unaccounted — silent abandonment.
Confronting a miss repeatedly is accountability, not avoidance, and is
legitimate evidence for a strength insight.

## Tone constraints (product-critical, not cosmetic)

Real reflection data contains heavy self-blame: "Sloth." "Bad day."
"unconsciousness." "Saturday, cut me some slack." That last one is preemptive
defensiveness toward the app itself.

The ICP ("the Capable Drifter") has already abandoned every planner that made
them feel like a failure. Therefore the narrator MUST:

- Name **structural** causes (a mechanism, a sequence, a missing cutoff), never
  character causes.
- Never echo the user's self-blaming vocabulary back at them.
- Never use: lazy, failure, discipline, "should have", willpower.
- Include at least one genuine, evidence-backed strength per insight set.
- State small-n honestly ("4 of your last 5"), never dress it as a percentage.
- Offer at most one small structural lever, never "try harder".
- Be truthful about a bad week. The test case is an 11%-completion week: the
  insight must not hide it, and must not moralise about it. Name the mechanism.

## What is deliberately deferred

- **Timestamp-based causal inference.** `rated_at` / `reflected_at` (migration
  010) record real user activity times and can eventually support genuine
  cross-day causality. They only began collecting recently, so there is
  insufficient history to validate against. Revisit once several weeks of
  evenings exist.
- **Bayesian confidence scoring / hypothesis engines / RL-scored intervention
  libraries.** Evaluated and rejected for this stage: every threshold and prior
  would be invented rather than calibrated, and per-user intervention
  effectiveness needs an n a single user will never reach. At current scale,
  `GROUP BY` finds the patterns that matter. Revisit when real multi-user data
  can calibrate the parameters.

## Why onboarding stopped using AI

The original onboarding was a four-turn Claude conversation that produced a
psychology profile — peak energy times, avoidance patterns, sabotage triggers,
a prose summary. It was deleted.

Three reasons, in order of weight:

**It contradicted the product thesis.** The engine is built on the premise that
what a user says on day zero is noise and what they do over 30 days is signal.
Every data-integrity rule in this document exists because self-reported and
inferred claims turned out to be wrong. An AI-generated profile from a
four-message conversation is exactly the kind of claim the rest of the system
refuses to make.

**It was superseded within a week.** Whatever the profile guessed about
avoidance patterns, the behavioral evidence pack discovers properly from actual
completion data, swap history, and the user's own reflections written in
context. The profile was a placeholder for intelligence the system produces on
its own.

**It was the only unbounded cost and the only real abuse surface.** Onboarding
fired multiple Claude calls per signup with no completion gate, so a single
account could re-onboard repeatedly and any number of throwaway accounts could
run up API spend before a cent of revenue.

What replaced it captures the two things that are actually used —
`accountability_tone`, which the weekly narrator reads directly, and
`peak_energy_times` — plus recognition questions whose job is not data at all.
Asking "how many planners have you abandoned?" and "what usually kills it?"
before making any claim about the user is positioning, not extraction. The flow
ends by stating what the product actually offers: it learns from what happens,
so give it a week.

Deliberately NOT rebuilt: any generated "insight" derived from onboarding
answers. Three taps cannot support a behavioral claim, and presenting one would
reintroduce the exact failure the deletion was meant to fix.
