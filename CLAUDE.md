# FlexMax — Project Intelligence

*Read this before touching anything. It captures every hard-won decision.*

---

## What this app is

FlexMax is an AI-powered behavioral accountability mobile app.
Category: Execution Companion (not a calendar, task manager, or AI planner).
Thesis: schedule failures come from rigid, non-adaptive tools — not user willpower.
One-liner: "Habit trackers watch you fail. FlexMax figures out why."

---

## Competitive positioning: FlexMax vs. Structured

Structured (unorderly GmbH) is the category king in visual day-planning:
15M+ downloads, 500K+ Pro users, 400K+ five-star reviews, Apple Editor's
Choice. It has explicitly moved onto our ICP's turf — its App Store copy
now says "whether dealing with ADHD, autism, or simply seeking a bit more
structure" — and it is not standing still on AI: "Structured AI" creates
schedules from natural language, and the team has publicly said they're
reworking their AI assistant.

**Conclusion: we cannot win as "a beautiful, simple time-block planner."**
That position is occupied, polished, and well-funded. Any positioning that
reads as "like Structured but—" loses by default.

### Where the seam is

Two findings from Structured's own reviews and marketing:

1. ADHD-focused reviews of Structured cite the same limitation repeatedly:
  it becomes discouraging when the timeline is overfilled, and it only
   works well when the day plan is realistic. In other words: Structured is
   a beautiful mirror of your plan. It works when you're already doing
   well. When you fall behind, the mirror shows you failing, in gorgeous
   detail — the exact shame-spiral our ICP (the "Capable Drifter") has
   already quit every other planner over.
2. Structured's own answer to missed tasks is "Replan — reschedule with a
  quick swipe." That is mechanical relocation: the block moves, nothing
   learns. Miss morning gym 40 times, replan it 40 times, and Structured
   will happily schedule morning gym #41, identical to #1. It treats the
   symptom (an unfinished block) and is structurally blind to the cause.



### FlexMax's answer

Structured answers "what is my day?" FlexMax answers "why does my day keep
breaking, and what should change?" Structured captures the plan. FlexMax
captures the failure data — completion_ratings, reflection_why,
reflection_improve, removed_reason, swap patterns — and v2b's behavioral
learning turns that into an evolving model of the person. Structured's
Replan moves the block. FlexMax's recovery asks why, remembers the answer,
and eventually stops proposing blocks the user's own data says don't
survive.

One-liner against them: "Structured shows you your plan. FlexMax learns
why your plans fail."

### Implications this creates (binding on future work)

- **v2b is not just a feature, it is the entire differentiation.** Until
the psychology profile evolves from behavior, FlexMax is an objectively
worse Structured — less polish, fewer integrations, no widgets, no Apple
Watch. The moment the profile evolves, FlexMax is in a category
Structured cannot enter without abandoning its own identity. This raises
the priority of the v2a capture-gap fixes (swap audit trail, notification
response tracking, check-in timing) — they are prerequisites for v2b, and
data not captured today is unrecoverable later.
- **The miss/recovery moment is the battlefield.** Structured's weakest
moment is falling behind — a timeline that turns into a wall of missed
blocks. That exact moment must be FlexMax's strongest. When a user misses
multiple blocks, Structured shows multiple failures; FlexMax must show
one recovery path and zero judgment. Any UI touching missed-block
recovery should be designed with this contrast explicitly in mind.
- **AI scope boundary: their AI accelerates planning, ours must accelerate
understanding.** Structured AI's job is to create a schedule faster from
natural language — that is input/creation. If FlexMax's AI roadmap drifts
toward "AI that builds your schedule for you" as its main value, we are
building Structured's feature, not ours. Keep FlexMax's AI focused on
learning and adapting to the user's demonstrated behavior, not on
authoring the plan itself.

**Positioning lines that have been proposed and rejected:**
- "The planner that learns why you quit" — reintroduces the planner category
  this document explicitly refuses. Any line containing "planner" concedes
  Structured's ground.
- Headline recap copy leading with completion percentage — fails the bad-week
  test. The weekly recap deliberately leads with days accounted for.
- Any claim of the form "moving X increased completion by N%" — a causal claim
  requiring a controlled comparison that the data cannot support.

Accepted and still open: "Your schedule keeps failing because it doesn't know
you." Stays out of the planner category and names the pain directly.

---



## Stack

- **Mobile:** Expo / React Native (tested on physical iPhone via Expo Go / EAS)
- **Backend:** Supabase (auth, Postgres, RLS, Edge Functions, pg_cron)
- **AI:** Anthropic Claude API (claude-sonnet-4-6) via Edge Functions ONLY — never client-side
- **State:** Zustand
- **Gestures:** react-native-reanimated + react-native-gesture-handler
- **Notifications:** expo-notifications (local scheduling for block check-ins)
- **Time:** minutes-since-midnight integers throughout
- **Repo:** github.com/mbquresh/flexmax (monorepo: apps/mobile, supabase)
- **Supabase project ref:** njsoqgaorebtwwcxgagf

---



## Critical workflow rules

- `supabase db push` is BROKEN — migration history is out of sync with remote.
ALL schema changes go via Supabase SQL Editor manually.
- Every new migration = paste the SQL into the dashboard + wait ~30s for schema cache.
- One fix per commit for anything touching security or swap logic.
- Claude = architecture/strategy layer producing Cursor prompts.
Cursor = implementation engine.
- Test on physical iPhone always. Expo Go simulator behavior not trusted.

---



## Database migrations (all applied manually to remote)


| #   | File                          | What it does                                                                                                               |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 001 | initial_schema.sql            | All core tables, RLS, generate_daily_instances fn                                                                          |
| 002 | profile_on_signup.sql         | Auto-create profile on auth.users insert                                                                                   |
| 003 | schedule_tips.sql             | schedule_tips column on psychology_profiles                                                                                |
| 004 | block_flexibility.sql         | is_fixed on schedule_blocks + daily_schedule_instances                                                                     |
| 005 | block_removal.sql             | removed_reason column on daily_schedule_instances                                                                          |
| 006 | adhoc_tasks.sql               | adhoc_tasks table + RLS                                                                                                    |
| 007 | secure_generate_instances.sql | Security split: generate_my_daily_instances (client-safe, auth.uid() scoped) + revoke execute on global from authenticated |
| 008 | swap_instances_rpc.sql        | swap_instance_times transactional RPC (atomic, ownership-validated)                                                        |
| 009 | swap_audit_trail.sql          | instance_time_changes audit trail + trigger (swap RPC untouched)                                                           |
| 010 | checkin_timing.sql            | rated_at / reflected_at on daily_schedule_instances + trigger                                                              |
| 011 | local_time_notify.sql         | users_to_notify_now RPC for per-user local-hour notifications                                                              |
| 012 | sweep_unaccounted.sql         | sweep_unaccounted_instances RPC + hourly cron; unaccounted status                                                          |
| 013 | behavior_evidence.sql         | get_behavior_evidence() RPC — precomputed 30-day facts                                                                     |
| 014 | actual_end_minutes.sql        | actual_end_minutes column for real bedtime capture                                                                         |
| 015 | behavioral_insights.sql       | behavioral_insights table; weekly stored beliefs, RLS read-only for users                                                  |


---



## Architecture decisions — do not relitigate these



### Swap logic (unified anchor-rebuild model — took 5+ iterations)

Both adjacent and separated swaps rebuild from the earlier block's start.
Later block goes first, original gap preserved, earlier block follows.
Collision check against all other blocks before committing.
Bounds check (0–1440) before RPC call.
**Never revert to "trade starts" or "tile only" — both are wrong.**

### Gesture architecture (territorial — took 4+ iterations)

- **⠿ handle rail only** → vertical drag-to-swap (plain pan, immediate)
- **Card body horizontal swipe** → reveals Missed + Remove (activeOffsetX(-15), failOffsetY([-8,8]))
- **Card body tap** → check-in
- **Vertical scroll** → passes through (gestures yield to ScrollView)
- Composed with Gesture.Race(dragGesture, swipeGesture)
- Fixed blocks: .enabled(false) on both gestures
- **Do not add long-press anywhere — it collides with drag and breaks scroll**



### Swap RPC is atomic

Client sends both new times to swap_instance_times RPC.
RPC validates ownership (auth.uid()) and updates both rows in one transaction.
Optimistic UI only applies AFTER successful RPC return.

### Time representation

All times stored as minutes-since-midnight integers.
getLocalDateString() for all date operations — never toISOString() (timezone bug).
AppState listener handles date rollover at midnight.

### AI calls — edge functions only

Claude API key never on client.
AI_PROVIDER=anthropic; demo/offline fallback kept for graceful degradation.
Edge functions: onboarding-chat, extract-psychology-profile, generate-schedule-tips,
missed-block-recovery, nightly-notify, weekly-insight.

### AI onboarding (shipped — slated for removal)

Current: 4-turn conversational onboarding via `onboarding-chat` +
`extract-psychology-profile`; gates app access on `psychology_profiles.completed_at`.

> **Slated for removal.** The 4-turn AI onboarding is planned to be replaced with
> preset questions. Reasoning: the psychology profile it produces is a day-one
> guess that 30 days of behavioral evidence supersedes anyway; it is the least
> necessary AI surface in the product; and it is the only unbounded per-signup
> cost. Do not build new dependencies on `raw_ai_summary` or on the onboarding
> transcript.

### Nightly notifications

pg_cron '0 2 * * *' (9PM CST) → nightly-notify edge function.
Auth: CRON_SECRET Bearer token (NOT service-role key — see SETUP.md).
config.json has verifyJWT:false for this function.

### Post-block check-in notifications

Local scheduling only (Expo Push API can't schedule future delivery).
scheduleTodayBlockNotifications() runs on loadToday AND after every swap/reschedule.
Cancel-all-then-reschedule pattern (idempotent).

---



## Security — what was fixed and why

1. **generate_daily_instances** was a cross-tenant write primitive (SECURITY DEFINER, no user filter).
  Fixed: client calls generate_my_daily_instances (auth.uid() scoped).
   Global version execute revoked from authenticated/anon — cron uses service role.
2. **AsyncStorage** was missing — sessions didn't survive app restarts.
  Fixed: storage: AsyncStorage in Supabase client config.
3. **handleSwap** was two sequential updates — half-commit possible.
  Fixed: swap_instance_times RPC, both writes atomic.
4. **Onboarding gate** only existed on index.tsx.
  Fixed: RequireAuth checks completed_at; refreshProfile() awaited before nav.
5. **Stats timezone** used toISOString (UTC) while streak used local dates.
  Fixed: toLocalDateStr() helper used everywhere.

---



## Behavioral engine data flow (v2b — SHIPPED)

Captured → read by the engine:

- completion_rating, reflection_why, reflection_improve (check-ins + misses)
- removed_reason, swap patterns via instance_time_changes (009)
- rated_at / reflected_at check-in timing (010)
- unaccounted status from the hourly sweep (012)
- actual_end_minutes — real bedtime, retroactively captured (014)

Pipeline:
  get_behavior_evidence(user_id)  [SQL, 013 — does ALL arithmetic]
    → weekly-insight edge function [1 AI call per user per week]
    → behavioral_insights table [015 — stored beliefs, superseded weekly]
    → injected FREE at read time into: recovery sheet, morning InsightCard

Still captured but NOT yet read:

- Notification response (whether a nudge was acted on) — not captured at all yet

---



## v2 roadmap — status as of commit b1bca42



### Shipped


| What                                          | Where                                                 |
| --------------------------------------------- | ----------------------------------------------------- |
| Rate limiting on all AI edge functions        | _shared/rateLimit.ts; check placed AFTER cache checks |
| EAS build → TestFlight (internal only)        | eas.json; F-mark icon set                             |
| Hamburger menu + action sheet                 | AppMenu.tsx; tricolor button                          |
| Plan Tomorrow screen + notification deep-link | app/plan-tomorrow.tsx                                 |
| Per-user local-time notifications             | users_to_notify_now RPC (011); hourly cron; DST-proof |
| Device timezone sync                          | profiles.timezone, written on session establish       |
| Swap audit trail                              | 009, trigger-based — swap RPC untouched               |
| Check-in timing                               | 010, rated_at / reflected_at                          |
| Unaccounted sweep                             | 012, hourly, timezone-aware, 4am local grace          |
| Behavioral evidence pack                      | 013                                                   |
| Retroactive bedtime capture                   | 014 actual_end_minutes (legacy column; data migrated to day_log) |
| Behavioral learning v1 (THE flagship)         | 015 + weekly-insight + InsightCard                    |
| Deterministic recovery copy (AI call REMOVED) | src/lib/recoveryCopy.ts                               |
| Seven-beat preset onboarding | Replaces 4-turn AI chat. Recognition screens, tone/energy/pattern questions, answer playback, contract screen. Deletes onboarding-chat, extract-psychology-profile, generate-schedule-tips |
| Accountability streak (80% threshold)         | stats.ts; two-tone square encoding                    |
| Close-today sweep merged into evening ritual  | plan-tomorrow.tsx + CloseTodayRow; Done/Missed only, preset miss reasons |
| Preset miss reasons                           | 019 miss_reason_tag; structural labels only, never stored as reflection prose |
| Cutoff nudges + telemetry                     | blockNotifications.ts; fires at midpoint or end-30, gated on task_detail; 016 nudge_events |
| Notification action buttons                   | "Wrapping up" / "Need 15 more"; 018 nudge_response    |
| nudge_line on insights                        | 017; notification-sized restatement, written in the same weekly AI call |
| Day boundaries (sleep/wake)                   | 020 day_log; replaces BedtimeCard; wake/sleep rows on schedule builder |
| Morning InsightCard                           | Rank-1 non-strength insight, dismissed per-insight, 8-day expiry |




### Not built


| What                                            | Notes                                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Presence-aware nudges (block-start + mid-block) | The "smart notification suite". User requested this in their OWN reflections 3x: "harder cutoffs", "need enforcements", "maybe you can do something to help" |
| Shareable weekly recap card                     | The weekly scorecard. Growth primitive                                                                                                                       |
| Day-3 first observation                         | New users currently see NOTHING for 5+ days (weekly-insight gates at engaged_days < 5). Week one is when they decide to keep the app                         |
| Paywall + RevenueCat                            | Hard paywall $14.99/mo, fires after onboarding screen 7. Placement RESOLVED.                                                                                   |
| "Ask me about yourself" conversational surface  | Reads get_behavior_evidence with the narrator's tone rules                                                                                                   |
| reflection_improve UX fix                       | 31% fill rate on the highest-signal field in the DB                                                                                                          |
| External TestFlight                             | Needs Beta App Review (~1 day) + a demo account or auto-rejection                                                                                            |
| Screen Time shielding                           | FamilyControls entitlement — STILL UNFILED. Multi-week Apple clock                                                                                           |
| Dark theme                                      | Design tokens make it feasible                                                                                                                               |
| Night routine block is hard to answer           | Excluded from the evening sweep (hasn't happened yet) and from bedtime notifications (by design). Drifts to unaccounted unless answered from Today. Candidate fix: a third question on the morning DayBoundaryCard |
| User instructions page                          | The streak rises on a day where everything was missed. The label qualifier was removed for width, so there is no in-app explanation. Owed |
| Onboarding demonstration beat | Onboarding establishes the pain (screens 1-2) and sets the contract (screen 7), but never shows what the product DOES. A stranger goes from "how many planners have you abandoned?" to a $14.99 wall without seeing FlexMax work. Fix: show a REAL generated insight, explicitly labelled as another user's, before the contract screen. Not a claim about them — a demonstration. See rejected approaches below |
| Showcase page carries the offer | docs/index.html has no pricing and no founding-member framing. With no trial it is the only pre-purchase evaluation surface, and most of the "is this enticing" work happens there and in the App Store listing, not in onboarding |


---


## Feature triage (2026-08-02)

Ideas evaluated from an external strategy session. Decisions and reasoning
recorded so they are not re-argued from scratch.

### Accepted — build

**1. The accounted-for streak (replaces the completion streak).**
The streak currently counts days with at least one `completed` block, so it
breaks on the first bad day — the historical uninstall trigger for this ICP.
Change the protected number to "every block accounted for, honestly": a day
counts if every instance has a real user-set status, regardless of outcome.
`missed` (engaged, admitted) keeps it alive; only `unaccounted` (silence)
breaks it.

Supported by real data: the sole user's Fajr+Quran block shows 14 missed and 1
unaccounted — they show up to admit failure. That is the behavior worth
protecting. Weights shows 6 missed and 15 unaccounted — silent abandonment is
the real drift, not the miss.

SHIPPED. The streak is accounting-based at an 80% daily threshold. The square
encoding went through three iterations — accounting-ratio fill (rewarded
missing), fill plus outline (no payoff for closing out), and finally a stacked
two-tone fill: teal for completed, neutral for missed, empty for unanswered.
A fully-accounted day fills completely. The missed segment must never be coral.

**2. Quality-drift signal in the evidence pack.**
`completion_rating` (crushed it / partly / lost focus) is captured on every
check-in and read by nothing — it appears zero times in
`get_behavior_evidence`. A block still completing but trending toward "lost
focus" is an earlier warning than a miss. ~15 lines of SQL, no new AI cost.

**3. Merged evening ritual: close today → plan tomorrow.**
An external proposal for a "close the day" screen conflicts with the existing
9pm push → Plan Tomorrow flow. Two evening rituals compete for the same 60
seconds and users will do one or neither. They merge into ONE flow behind the
existing notification: sweep today's blocks to a real status (feeding the
accounted-for streak and fixing data quality), then plan tomorrow.

The "load governor" idea belongs inside this flow: after seeing today's
reality, push back on an overbuilt tomorrow by comparing planned flexible
minutes against the trailing 30-day *completed* median. TONE WARNING: "you're
scheduling 9 hours, your real median is 5.5" is one word away from "you are not
capable of this." Structural framing only.

### Deferred — with reasons

**Survival forecast at planning time** ("blocks like this after 8pm survived 2
of your last 14"). Requires slot VARIANCE to have a counterfactual. A user whose
schedule is static has every instance of a block in the same slot, so there is
nothing to compare against. Works only for users who move blocks frequently.
Less universal than it appears.

**Voice reflections.** Correct target — `reflection_improve` fill rate (31%) is
the known bottleneck and reflections are the highest-signal data in the system.
But it means a new vendor (transcription), new per-use cost, and real native
work. The cheaper fixes are already queued: recovery presets, a `miss_reason_tag`
column, and an optional completion-side reflection field. Test those first. If
fill rate moves to ~55%, voice is unnecessary.

**Graduation / block retirement.** Proposing progression or retirement once a
block sustains high completion. Conceptually strong and it is the product's
answer to "what happens after six months" — but it needs months of sustained
data that no user has yet.

**Monthly letter with memory.** One AI call a month citing the user's own past
reflections back to them. Needs months of history, and overlaps with the planned
shareable weekly recap card — these should be ONE surface, not two.

**Declared rest days / rebellion valve.** Onboarding turn 4 currently asks
whether accountability makes the user rebel and nothing consumes the answer.
The "closes an existing loop" argument dies with the AI onboarding removal.
Salvageable later as a preset question, but it needs new schema (a rest-day
flag), so it is not free.

### Rejected

**"Addiction to 100% completion scores" as a design goal.** A perfect-score
mechanic is brittle by design: the first 60% day breaks the spell, and for this
ICP that is the uninstall moment. Superseded by the accounted-for streak above.

**Engagement-mechanism vocabulary in user-facing copy.** Words like "addiction",
"hooked", "streak-breaking" describe our internal mechanics, never the user's
experience. Internal-only. This has now surfaced from more than one source, so
it is recorded as a standing copy rule.

---

## v2-issues.md deferred items

1. AI rate limiting on edge functions (priority: HIGH before public launch)
2. Stack-trace / service-role audit on edge functions
3. CHECK constraints on status columns
4. Stale-request guard on loadToday

---



## Product context (for AI-assisted decisions)

**Ideal customer:** "The Capable Drifter" — 20-32, ambitious, serial abandonér of
Notion/Habitica/planners, ADHD-adjacent segment deliberately valuable, converts
Sunday evening, pays $10/mo, allergic to toxic-positivity AND shame, Apple-polish taste.

**Day-planning competitor:** Structured — see **Competitive positioning** above.

**Habit-tracker competitor:** Me+ Lifestyle Routine (Enerjoy) — 21M downloads, 4.79 stars.
Validates market. Static tracker, MBTI "personalization," self-care framing.
Positioning: "Me+ helps you decorate a routine. FlexMax helps you keep one."
Compete ONLY on adaptive intelligence + flexibility axis. Never on templates or aesthetics.

**Pricing:** See **Pricing & paywall** below.

**The moat:** accumulated per-user behavioral understanding. Switching cost grows
every week of use. Models commoditize; behavioral history doesn't.

**The retention risk:** shame-churn. Users who fail may avoid reopening the app.
Recovery-without-judgment is the design bet. Instrument this in the beta.

---



## Honest risks (carry these — do not let them drift)

- **Everything is validated on n=1.** Every filter, threshold, and tone rule was
tuned against the author's own month of data — an unusually diligent
self-journaler who wrote 31 reflections in 30 days. Whether any of it survives
sparse, low-effort user data is untested and is the whole ballgame.
- **Reflection dependency is the bottleneck.** The engine is text-first because
the user's own words are the highest-signal data. Most users write nothing.
reflection_improve is at 31% fill for the ONE user who exists.
- **The moat is retention-dependent.** Accumulated behavioral history only
compounds if the user keeps opening the app. Shame-churn is the named risk.
- **Differentiation is more copyable than this document implies.** A funded
incumbent could ship a weekly "why your plans fail" card as a feature update.
The durable edges are tone discipline, data-integrity care, and eventually the
behavioral corpus itself.
- **NORTH-STAR METRIC: reopen rate after a bad week.** Everything else is
downstream of whether people come back after failing. Instrument this before
external testers arrive, not after.



## Beta success criteria

Four proof points, in order. Everything else is downstream of these, and none
can be answered without real testers.

1. **Can strangers understand the difference in 10 seconds?** Not "is it good" —
   can someone who has never heard of it tell FlexMax apart from a planner from
   the App Store listing and the showcase page alone.
2. **Will they pay before using it?** The hard paywall is deliberate and filters
   for the decided cohort, but the conversion floor is unknown.
3. **Will they reopen after a bad week?** The north-star metric. Instrument it
   before testers arrive.
4. **Does the behavioral insight feel surprisingly accurate?** The entire
   differentiation reduces to this. Validated on n=1 so far.

If 1-4 hold, $14.99 is not the limiting factor. If they do not, more features
will not fix it.



## Pricing & paywall (DECIDED — supersedes all earlier versions)

- **$14.99/month. NO free trial.** Hard paywall.
- **~$99/year**, shown at checkout as monthly-equivalent ("$8.25/mo, billed
  annually"), never as a lump sum.
- **No weekly plan.** Weekly billing selects for the user this product serves worst.
- **Grandfathering: early users lock their price permanently.** "Locked for life"
  must be explicit copy on the paywall and account screen, not implied. At $14.99
  this is a materially stronger retention lever than at $9.99.

**Founding-member framing.** For the first 100-500 users, present the annual
plan as founding membership rather than a discount: "Founding members: $99/year,
locked forever." Same price, different frame — it creates urgency and positions
early buyers as participants in something being built rather than customers of
something finished. Consistent with the contract screen's framing.

**Rationale for no trial at this stage:** every free user costs real Anthropic
spend; payment is itself the first commitment device in an accountability
product; direct buyers outperform trial-converted users on LTV in productivity;
and 200 paying users produce cleaner retention data than 5,000 free installs.
This is a STAGE decision — value-gated freemium is the correct scale strategy
later, once the insight engine is proven.

**Accepted cost:** some "paywalled instantly, didn't get to try it" reviews.
That is the tax of the approach, not a signal something is broken.

**Paywall placement (RESOLVED).** The wall fires immediately after onboarding
completes — after screen 7 of the seven-beat preset flow. Earlier strategy
anchored it to the AI onboarding's psychology-profile reveal; that flow was
deleted, and the replacement earns the ask differently:

- Screens 1-2 are RECOGNITION ("how many planners have you abandoned?", "what
  usually kills it?"). They name the user's failure history before the pitch.
- Screen 6 plays their answers back as declarative fragments. Proof of
  listening, with zero fabrication.
- Screen 7 is the contract: "FlexMax learns from what actually happens. The
  patterns come from what you do, not what you say. Give it a week."

That last screen reframes the $14.99 honestly — the user is funding an
observation period, not buying a finished product. That is the true version of
the aha the AI conversation used to fake.

**DEPENDENCY — docs/index.html is now commercially load-bearing.** With no trial,
the public showcase is the only place a prospective payer can evaluate the
product before paying. It currently carries no pricing and no founding-member
framing. It must stay in sync with the shipped app AND carry the offer.

### Rejected: generating an "insight" from onboarding answers

An external strategy suggestion proposed showing a personalized finding at the
paywall, derived from the preset answers — e.g. "Based on your answers, your
biggest risk is overloading mornings and relying on motivation after missed
blocks."

**Rejected.** Three taps cannot support a behavioral claim. This is the exact
failure the AI onboarding was deleted to eliminate: a day-zero guess presented
as intelligence. It violates the engine's founding rule (nothing is claimed that
the data does not support), and it creates a promise the product must then honor
— if the genuine day-7 insight contradicts the fabricated one, the user learns
to distrust the thing they paid for.

Screen 6 solves the same problem honestly: it reflects the user's own answers
back without interpreting them. Recognition, not fabrication.

This proposal has now surfaced three times from external strategy sources, each
time more specific — most recently as a four-line "execution profile" ("You tend
to overload mornings. Your consistency drops after interruptions. Your best
completion window is late afternoon."). It keeps recurring because it is the
obvious answer to "how do you earn a paywall in 90 seconds." It stays rejected
for the same reason each time: three taps cannot support a behavioral claim, and
a fabricated day-zero profile that the genuine day-7 insight contradicts teaches
the user to distrust the product's core output.

The legitimate version of the same instinct is to DEMONSTRATE rather than claim:
show a real insight the engine actually produced, explicitly labelled as another
user's, and let it speak for what the product does. See "Onboarding
demonstration beat" in the roadmap.
