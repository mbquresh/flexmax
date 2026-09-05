# FlexMax — Project Intelligence

*Read this before touching anything. It captures every hard-won decision.*

> **Maintenance discipline.** Sections describing CURRENT ARCHITECTURE (edge
> functions, migrations, shipped features) rot fast and must be checked against
> the tree before being trusted. Sections describing REASONING — rejections and
> their revival conditions, postmortems, hard-won mechanical constraints,
> honest risks — do not rot and are the highest-value content here. When the
> two conflict, the tree wins and the architecture section is wrong.

---

## What this app is

FlexMax is an AI-powered behavioral accountability mobile app.
Category: Execution Companion (not a calendar, task manager, or AI planner).
Thesis: schedule failures come from rigid, non-adaptive tools — not user willpower.
One-liner: "Habit trackers watch you fail. FlexMax figures out why."

---

## What the product actually does (the mechanism)

The failure mode is named in `Who FlexMax is for`: **unconscious inaction** —
time that evaporates without a decision ever being made. That section describes
what goes wrong. This one names what the product produces instead, because the
two are a matched pair and the positive half was missing.

**The state the product induces is conscientiousness.** Not motivation, not
discipline — the plan staying consciously present in the user's mind through a
day, instead of receding into background noise where it dies. Every ritual in
the app serves this: the morning card, the accounting sweep, the recovery flow,
the weekly insight. The user is repeatedly brought back into contact with their
own intentions.

Critically, this is induced without pressure. The app does not raise the stakes;
it surfaces the user's own data and lets them look. A pattern the user had a
hunch about becomes documented fact. The app is not telling them what to do —
it is removing their ability to not know.

**Category, internal use only: a Conscientiousness System.** Do not use this
phrase externally. It is a clinical, five-syllable word nobody searches for, and
conscientiousness is a Big Five personality trait, so claiming an app produces
it reads as claiming personality change. Same rule as "Capable Drifter": correct
internally, wrong in copy. External positioning stays as recorded in
`Product context`.

### Two value streams, and they have different dependencies

This is the single most important structural fact about the product, and it
resolves an apparent contradiction between competing outside advice.

**Stream 1 — Execution salvage. Works on day one.**
The swap resolver, displacement costs, shrink-to-fit, the Removed pile, the
recovery flow, the accounted-for streak. A day that breaks at 2pm gets rebuilt
instead of written off. This requires no reflections, no accumulated history,
and no AI — `ACCOUNTED = ["completed", "missed", "skipped"]` in
`src/lib/stats.ts` reads *status only*, and the recovery copy went deterministic
when the AI call was removed. Value lands immediately and repeats every day.

**Stream 2 — Behavioral insight. Compounds over weeks.**
The evidence pack, `weekly-insight`, the morning InsightCard. Needs
`engaged_days >= 5` before it says anything, and its depth scales with
reflection quality.

Roughly half the differentiation lives in each. Consequences:

1. **The hard paywall is defensible on Stream 1 alone.** The long-standing
   objection — the user pays before the engine speaks — has an answer: they are
   buying a working execution-salvaging tool immediately, with the insight layer
   arriving on top of it later. Marketing currently leads with Stream 2 and
   understates Stream 1. That is backwards for the first-week experience.
2. **Two metrics, not one.** Gate 1 (reflection fill rate) measures whether
   Stream 2 is self-sustaining. Stream 1 needs its own: *on days the plan
   breaks, does the user still complete the next meaningful action and return
   tomorrow?* Stream 1's metric is the one that must hold in week one.
3. **Outside advice that appeared contradictory was each describing one stream.**
   Recommendations to reduce reflection burden and add fast recovery affordances
   are Stream 1 optimizations. The argument that the accounting overhead *is*
   the product is a Stream 2 defense. Both are correct about their own half.

### The overhead is not a tax — but that is a hypothesis, not a finding

The five minutes of daily accounting looks like friction and is better
understood as the ritual that maintains conscientiousness. Without a point of
contact, the schedule drifts back into background noise.

**Treat this as a hypothesis Gate 1 tests, not a settled truth.** If reflection
fill rate clears ~50% with real testers, the friction is load-bearing and should
be protected. If it sits near the n=1 baseline of 31% or drops, then for most
users the overhead is a leak rather than a mechanism, and the honest response is
to move value into Stream 1 rather than defend the ritual on principle.

### Sacred friction vs. incidental friction

Not all friction is the mechanism. The distinction:

- **Sacred — never automate.** Contact between the user and their own data:
  seeing the displacement a reschedule causes, reading their own last written
  intention, choosing a status for every block. These moments *are* the
  consciousness-inducing event.
- **Incidental — fair game.** The input mechanism itself. Typing prose at 11pm
  is a keyboard tax, not a ritual. Voice reflections remove typing without
  removing contact, which is why they are in the Vision section rather than
  banned by this rule.

**Do not build any of the following.** Each removes a point of contact and
anesthetizes the exact mechanism the product runs on:

- Auto-reschedule ("we noticed you usually move gym to 7pm — want us to just do
  that?")
- Notifications that let the user resolve a block without opening the app and
  seeing the day
   *Responding to a nudge is not resolving a block. The shipped action buttons
   record a nudge response and deliberately do not write a block status — that
   is the line. Extending them to set status, mark complete, or close out a day
   without the user opening the app would cross it.*
- AI that writes the reflection for the user
- Any "reduce friction" change that removes a look at the schedule rather than a
  keystroke

The moment FlexMax optimizes away contact, it becomes a calendar. Calendars are
already frictionless, which is precisely why nobody pays attention to them.

---

## Category and boundaries

FlexMax is not a calendar, a task manager, a habit tracker, or an AI planner.
It is an execution companion: it salvages days that break and explains why they
keep breaking. Day-planning apps are not the reference point and should not be
used as one — benchmarking against them pulls the product toward planner
feature-parity, which is a category FlexMax does not compete in and cannot win
by entering.

These constraints are permanent. They are stated as first principles because a
rule justified by what some other product does expires the moment that product
changes.

**The AI's job is understanding, never authoring.** FlexMax's model reads
demonstrated behavior and explains it. It does not generate schedules, propose
plans from a text prompt, or decide what the user's day should contain. Faster
schedule creation is a different product with a different value proposition, and
every hour spent there is an hour not spent on the thing only accumulated
behavioral history can do. If a feature proposal begins "the AI builds your…",
it is out of scope by definition.

**The miss and recovery moment is the product's core surface.** Most planning
tools are at their weakest exactly when the user is doing badly — the plan
becomes a rendering of everything that didn't happen. FlexMax must be at its
strongest there. When several blocks fail at once, the response is one path
forward, not one failure marker per block.

**Depth over surface.** FlexMax competes on accumulated per-user behavioral
understanding, which grows with every week of use and cannot be replicated by
copying a screen. It does not compete on integrations, widget count, or platform
breadth. Those are worth building eventually (see Honest risks) and are never
the differentiator.

---

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

**The audience effect — real, but not a moat.** Human accountability carries a
tax: in front of a person, effort is diverted into managing perception, and the
partner can only work with what they are shown, so the most useful information
is precisely what gets withheld. An AI removes the audience — no one to
disappoint, no status to protect.

This is a genuine advantage over human accountability and a genuine reason the
input quality can exceed what a mentor obtains. It is NOT a moat: every AI
accountability product inherits it for free. Use it to explain why the approach
works; never as a claim about defensibility against competitors.

**The actual moat is per-user, not categorical:** accumulated
intervention → response → outcome data. Six months of what specifically works
on this person. That is not copyable by a competitor at any funding level,
because it requires that person's six months.

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
| 016 | nudge_events.sql              | nudge_events — cutoff nudge telemetry                                                                                      |
| 017 | insight_nudge_line.sql        | behavioral_insights.nudge_line — notification-sized insight restatement                                                      |
| 018 | nudge_response.sql            | nudge_events.response — which action button was chosen                                                                     |
| 019 | miss_reason_tag.sql           | daily_schedule_instances.miss_reason_tag — preset miss reason                                                              |
| 020 | day_boundaries.sql            | day_log — sleep/wake as day boundaries, replaces the BedtimeCard model                                                     |
| 021 | quality_drift.sql             | quality_drift added to get_behavior_evidence; completion_rating in base CTE                                                |
| 022 | preset_onboarding_columns.sql | psychology_profiles preset onboarding columns                                                                              |
| 023 | atomic_insight_replace.sql    | replace_behavioral_insights RPC — atomic insight set replacement                                                           |
| 024 | acknowledged_at.sql           | daily_schedule_instances.acknowledged_at + BEFORE UPDATE trigger — stamps on first real acknowledgment, cleared on undo      |
| 025 | value_constraints.sql         | CHECK constraints on status and completion_rating (NOT VALID)                                                              |
| 026 | cannibalization_and_interventions.sql | cannibalization, nudge_outcomes, miss_reasons in get_behavior_evidence; miss_reason_tag in base CTE                  |
| 027 | swap_drift_net_displacement.sql | swap_drift counts NET displacement per instance, not edit rows; fidget swap-backs excluded |
| 028 | reschedule_provenance.sql     | reschedule_count + original_start/end_minutes. Client-written, not trigger, so swaps are not counted as reschedules |
| 029 | quality_reason_tag.sql | quality_reason_tag column + CHECK; quality_drift window widened 5→7 rated instances; quality_reasons added to the evidence pack |
| 030 | app_sessions.sql              | app_sessions + record_app_open(date) RPC — one row per user per local date; repeats increment open_count             |
| 031 | account_deletion.sql          | delete_my_account() SECURITY DEFINER — deletes the caller's auth.users row; everything else cascades                 |
| 032 | displaced_by_id.sql           | daily_schedule_instances.displaced_by_id — recovery sacrifice vs user-deleted, both previously just 'removed'        |
| 033 | swap_drift_resolved_only.sql | swap_drift counts net displacement only on completed/missed instances; impact claim in its header is wrong, see Known issues 2026-08-26 |
| 034 | quality_reason_note.sql | Free-text companion to quality_reason_tag; not written to the tag (CHECK-constrained, must stay countable) nor to reflection_why (means "why missed", a different question) |
| 035 | day_boundary_overrides.sql | Sparse per-weekday wake/sleep overrides on profiles; scalar columns remain the default |
| 036 | accountability_tone_check.sql | NOT VALID CHECK on firm/gentle/data-driven; the column is written verbatim into the AI prompt and previously accepted anything |
| 037 | block_archive.sql | schedule_blocks.is_active; both generate_daily_instances and generate_my_daily_instances filter on it |
| 038 | miss_reason_denominator.sql | miss_totals added beside miss_reasons; tag counts had no base. Rewrites the deployed definition in place per 033's precedent, with anchor assertions that raise on drift |
| 039 | block_recency.sql | Per-block first_seen, days_tracked, and 7-day vs prior split. The pack was time-flat: a habit that stopped a month ago read as current, and a week-old block was diagnosed as broken |
| 040 | block_recurrence.sql | starts_on / ends_on / interval_weeks / anchor_date on schedule_blocks, plus block_exceptions for advance skip. Both generate_* functions updated. All defaults preserve prior behaviour |
| 041 | tracked_interval_aware.sql | tracked's floor scales with cadence: least(3, greatest(2, count(*))). A biweekly block could never reach a flat floor of 3 and was silently invisible to the whole engine |
| 042 | away_periods.sql | User-level date ranges where nothing generates. Both generate_* functions updated. Chosen over per-block exception rows: an away week written that way is 60+ rows, needs consecutive dates regrouped to display or cancel, and misses blocks created during the period |
| 043 | calendar_feed_token.sql | Secret for the public ICS feed URL, nullable and generated lazily so a user who never exports has no live endpoint. Unique partial index — the token is the sole lookup key for an unauthenticated endpoint, so a collision would serve one user another's schedule. get_or_create_calendar_token and revoke_calendar_token are SECURITY DEFINER with auth.uid() guards |
| 044 | removed_by.sql | Provenance on removal: user / displacement / archive / away. Four different things wrote 'removed' indistinguishably |
| 045 | backfill_marker.sql | backfilled_at + a BEFORE UPDATE trigger. Past-day editing makes every now()-stamping timing column (acknowledged_at, rated_at, reflected_at) unreliable: a block from last Tuesday answered today reports five days of recovery time. A trigger not a client write, because a marker protecting a metric must not depend on every future call site remembering it. Compares against the user's own timezone, since yesterday is the common backfill and a UTC comparison would read it as same-day for half the world. Only an outcome write marks the row — a swap or task_detail edit is housekeeping. Once marked, always marked: the day cannot come back |
| 046 | block_time_overrides.sql | Sparse per-weekday time overrides on schedule_blocks; both generate_* functions resolve them. Base columns unchanged, nothing backfilled |

030 exists to answer the supporting reopen signal: of users who had a bad week, what
share opened the app the following week. Capture is fire-and-forget from
AuthProvider (cold start + foreground, 60s debounce). Time-in-app is not a
signal — a phone in a pocket looks identical to engagement.

```sql
-- Of users who had a bad week, what share opened the app the following week?
with weekly as (
  select user_id,
         date_trunc('week', date) as wk,
         avg((status = 'completed')::int) as rate
  from daily_schedule_instances
  where status in ('completed','missed','skipped')
  group by 1, 2
)
select w.rate < 0.5 as bad_week,
       count(*) filter (where exists (
         select 1 from app_sessions s
         where s.user_id = w.user_id
           and s.local_date >= (w.wk + interval '7 days')::date
           and s.local_date <  (w.wk + interval '14 days')::date
       ))::float / count(*) as returned_next_week
from weekly w
group by 1;
```


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

Edge functions (2):
  weekly-insight   — 1 AI call per user per week; the only AI call in the product
  nightly-notify   — cron-triggered, no AI; MUST deploy with --no-verify-jwt

weekly-insight hardcodes the Anthropic client. There is no provider
abstraction and no fallback — if the API is down, insights do not
regenerate and the previous set remains active until they do.

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



## v2 roadmap

Status is maintained by editing the tables below when work lands. Do NOT
pin this heading to a commit hash — the previous header claimed "as of
b1bca42" while 103 commits had landed since, which is worse than no
marker at all.

> **UNBLOCKED ACTION — file the FamilyControls entitlement requests now, for
> every bundle ID (main app and each planned extension).** This has never been
> confirmed as submitted. It is free, it is Apple's clock not ours, approval
> takes days to weeks, and filing does not commit us to building anything.
> Requests get stuck; filing early is the only mitigation.



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
| Behavioral learning v1                        | 015 + weekly-insight + InsightCard                    |
| Deterministic recovery copy (AI call REMOVED) | src/lib/recoveryCopy.ts                               |
| Seven-beat preset onboarding | Replaces 4-turn AI chat. Recognition screens, tone/energy/pattern questions, answer playback, contract screen. Deletes onboarding-chat, extract-psychology-profile, generate-schedule-tips |
| Accountability streak (80% threshold)         | stats.ts; two-tone square encoding                    |
| Close-today sweep merged into evening ritual  | plan-tomorrow.tsx + CloseTodayRow; Done/Missed only, preset miss reasons |
| Preset miss reasons                           | 019 miss_reason_tag; structural labels only, never stored as reflection prose |
| Cutoff nudges + telemetry                     | blockNotifications.ts; fires at midpoint or end-30, gated on task_detail; 016 nudge_events |
| Notification action buttons                   | "Wrapping up" / "Need 15 more"; 018 nudge_response    |
| nudge_line on insights                        | 017; notification-sized restatement, written in the same weekly AI call |
| Day boundaries (sleep/wake)                   | 020 day_log. Sleep/wake capture REMOVED FROM THE UI 2026-08-24 — the table and history remain, but nothing prompts for it. Rationale: day_log is read by no version of get_behavior_evidence, so it was pure capture with zero consumption; worse, DayBoundaryCard shared a render slot with the morning InsightCard and took precedence, suppressing the engine's only daily output on every morning it fired. Wake/sleep TARGETS on profiles are unaffected and remain load-bearing for findRescheduleSlot. Wake/sleep rows on the schedule builder (BoundaryRow) are unaffected |
| Morning InsightCard                           | Rank-1 non-strength insight, dismissed per-insight, 8-day expiry |
| Dark theme                                    | lightColors / darkColors, ThemeProvider, System/Light/Dark toggle |
| Brand mark and loader                         | BrandMark SVG, BrandLoader on six full-screen loads |
| Press feedback system                         | PressableScale scale + highlight variants |
| reflection_improve chips                      | REMOVED 2026-08-24. Chips turned the highest-signal free-text column into six repeated strings; eight taps of "Start earlier" is chip affordance, not a pattern. Column and history retained, capture UI deleted. Also resolves the open question of whether the evidence pack should weight canned answers differently — there are no new canned answers. recoveryCopy now filters legacy chip labels out of the "Last time you wrote" callback rather than quoting a tapped preset as the user's words |
| Reschedule sleep boundary                     | findRescheduleSlot respects sleep_target_minutes; manual adjust in RecoverySheet |
| Acknowledgment timing                         | 024. Recovery time (deviation → acknowledgment) is now computable. Un-backfillable, which is why it led Tier 1 |
| Value constraints                             | 025. status and completion_rating. NOT VALID so legacy rows are untouched; all future writes governed |
| loadToday stale-request guard                 | Sequence token per load; superseded loads discard their results rather than overwriting newer state |
| Test infrastructure                           | vitest on pure modules. Covers the streak threshold, the accounted-but-missed day, unaccounted transparency, and the recovery copy branches |
| Reschedule conflict resolver | recovery/[id].tsx + planDisplacement in schedule.ts. Reschedule previously WARNED on collision and committed the overlap anyway; overlapping instances were legal in the DB and corrupted notification scheduling, findRescheduleSlot's occupied list, and cannibalization's time-ordering. Now: one movable collider is offered as a displacement ("move Dinner to 8:15"), everything else refuses to "Pick another time". Never writes an overlap. Two-row write is atomic via the existing swap_instance_times RPC — no new migration |
| Quality degradation prompt | CheckInSheet + today.tsx. Fires when a block is rated partial/pulled_away AND 4+ of its last 7 rated instances were poor. Writes quality_reason_tag from five presets. Once per block per week, cooldown written when SHOWN so skipping does not re-prompt. Reuses CheckInSheet's geometry by swapping content — no second modal, per the RecoverySheet postmortem. Threshold matches quality_drift's rn<=7 window (029) so the prompt and the weekly insight cannot contradict each other; 'Something else' opens a free-text note written to quality_reason_note |
| Profile page: preferences, not observations | account.tsx. Removed the "What FlexMax learned about you" section — it gated on psychology_profiles.completed_at, written only by the deleted AI onboarding, so it showed an empty state pointing at onboarding that no longer exists. Replaced with controls that already govern app behaviour but had no UI: accountability_tone (injected into every weekly-insight prompt, previously unreachable after onboarding) and notification permission state (blockNotifications silently no-ops when denied, and nothing surfaced it). Behavioural observations belong on a dedicated surface, not behind a settings-shaped door — a user opening settings to change a toggle should not be confronted |
| Schedule builder refactor | schedule-builder.tsx split into ScheduleBlockCard, BlockFormSheet, CategoryChips, DayChips. Editing moved out of the FlatList row into a bottom sheet — inline expansion jumped row height ~400px, put a TextInput and a nested horizontal ScrollView inside a FlatList row, and recreated renderBlock on every keystroke. Add and edit were two copy-pasted forms behind twelve duplicated state hooks; now one BlockFormSheet with a single draft object. Behaviour-neutral: validation strings, save payloads, sort order and quick-add all unchanged. Sheet copies TaskDetailSheet's Modal structure exactly — KeyboardAvoidingView as the direct child carrying the overlay style, dismiss Pressable as a sibling not a wrapper |
| Block archiving | schedule_blocks.is_active (037). A block can retire without destroying its record. Card actions are now Edit / Archive; permanent delete moved into the edit sheet, because delete cascades to every daily_schedule_instances row and the one-tap action should be the reversible one. Archiving marks today's PENDING instance 'removed' so the block leaves Today immediately; completed and missed instances survive and keep feeding the evidence pack until they age out of the 30-day window |
| Shared miss reason presets | src/lib/missReasons.ts. Extracted from CloseTodayRow so any future surface writes identical strings — miss_reasons in get_behavior_evidence groups by exact value, so drift would split one reason into two rows |
| Pre-block nudge | src/lib/preempt.ts + blockNotifications.ts. Fires at start time for a block where 4 of its last 7 rated occurrences failed — the same threshold as the quality degradation prompt, so no new constant. AT MOST ONE PER DAY, worst record first, earliest start breaking ties: a qualifying block already gets start, cutoff and end notifications, and without the cap a bad week would nudge every block. Requires a full 7-occurrence window, so it never fires on thin data. Copy states what LANDED rather than what failed — same fact, but it arrives while the user is deciding whether to start, and naming a failure streak at that moment invites avoidance |
| Accounted for section | today.tsx. Completed and missed blocks move to a section at the bottom of Today, greyed, undo intact. The top list becomes exactly what is left, which is what makes a late-day reschedule legible — a morning block can be moved into an afternoon whose blocks are already resolved, and the open time reads as open. Missed blocks go here too: an answered block is not unfinished business, and the accounted-for streak already counts it as engagement. Cards here do not register onLayout and cannot be dragged or swiped, so cardPositions only ever holds open cards — this SHRINKS the drag surface. A pruning effect clears stale entries when a card leaves the open list, without which findSwapTarget could match a phantom position |
| End time on reschedule | recovery/[id].tsx. The "Ends" picker was gated behind slotIsFallback, so duration could only be changed when the app failed to find a slot. Always available now |
| Drag auto-scroll | today.tsx + BlockCard.tsx. Dragging near the top or bottom edge scrolls the list, so a swap target off-screen is reachable. Speed ramps with depth into a 90px edge zone. Driven by useFrameCallback rather than the gesture's onUpdate, because onUpdate only fires when the finger MOVES — holding still at the edge would stop the scroll exactly when the user is waiting for a target to appear |
| Block recurrence UI | BlockFormSheet + src/lib/recurrence.ts. One collapsible "Repeats" section replaces the standalone day chips: summary row, expanding to days + an interval stepper + an optional end date. Modelled on Apple Calendar's repeat rule — the days, cadence and end date are one statement, not three settings, and collapsed the sheet is SHORTER than before because DayChips no longer occupies permanent space on a control nobody edits after setup. Expanded by default when adding, collapsed when editing. Inline expansion rather than a pushed screen, because a bottom sheet cannot push and sheet-over-sheet is the RecoverySheet trap. Stepper rather than a wheel: the CHECK constraint caps at 8 and a picker would need a dependency that is not installed. anchor_date is written once when a block first becomes non-weekly and never moved |
| Block form polish | BlockFormSheet. Fixed/Flexible became a two-tile segmented control — the single pill had no visible off-state and read as an available action when unselected. Helper text now describes the current state instead of defining the word. Every field labelled, since one field having a label and the rest not is worse than none having them. Uniform gap replaced with grouped spacing so the Save button no longer sits as close to the last field as fields sit to each other. Title is a static "Edit block" / "New block" rather than repeating the name shown in the input below it. Visual grabber added, with no pan gesture — a half-working drag-to-dismiss on this sheet is worse than none |
| Schedule builder polish | Primary action pinned to a bottom bar with safe-area inset — it previously sat inside ListFooterComponent BEFORE the archived section, so it was not even the last element on the page. Its disabled condition read blocks.length, which includes archived, so archiving every block left Continue enabled and sent the user to an empty day; now activeBlocks.length, with a hint explaining why it is disabled. Haptics added throughout: the first screen a user sees had ZERO, while six haptic functions ship and every other surface uses them. Success haptics fire only after a write resolves. Duplicate `section` key removed from makeStyles. Subtitle rewritten to orient rather than explain UI mechanics. First use of useSafeAreaInsets in the app |
| Time away | away_periods (042) + AwaySheet. A date range where no instances generate at all. Not skipped placeholder rows — tracked requires 25% of a block's instances resolved, so a week of unanswered rows would push blocks below the floor and drop them from the engine, which is the exact misreading this prevents. A range covering today also marks today's pending instances 'removed', since generation only prevents future ones. The accounted-for streak needed no change: computeStreakData requires relevant > 0, so an empty day neither breaks nor extends it |
| Calendar export (feed) | supabase/functions/calendar-feed, deployed --no-verify-jwt. ICS subscription feed of the TEMPLATE, not daily instances: Google refreshes subscribed feeds every 12-24 hours with no faster setting, so publishing instances would show a Google user yesterday's arrangement all day — confidently wrong and uncorrectable from the app. The calendar holds the plan, the app holds the day. Floating DTSTART (no Z, no TZID) so a 9am block reads as 9am wherever the device is, which also avoids emitting a VTIMEZONE clients disagree about. Recurrence maps directly from 040: interval_weeks to INTERVAL, ends_on to UNTIL, block_exceptions and away_periods to EXDATE. Archived blocks omitted |
| Calendar export UI | account.tsx + src/lib/calendarFeed.ts. Create, share, rotate and revoke the feed link. Token is generated lazily, so a user who never exports has no live endpoint. Sharing uses React Native's Share rather than a clipboard dependency — the iOS share sheet already offers Copy plus AirDrop, which is how a URL actually gets from phone to laptop. Two caveats shown inline: the link is unauthenticated and shows block names and times, and the feed publishes the TEMPLATE so same-day swaps do not appear. The second surprised the person who built it, which is why it is stated rather than assumed; shares a webcal:// link so tapping opens Calendar's subscribe flow directly, with a separate https:// share for Google, which takes a typed URL and rejects webcal. The UI recommends subscribing on a Mac: macOS saves the subscription to iCloud and syncs everywhere, while iPhone defaults to the local On My iPhone account and syncs nowhere, so a user who subscribes on both gets the schedule twice on their phone. The client chooses the account at subscribe time and no ICS property overrides it. |
| Onboarding rebuilt around an interactive demo | onboarding.tsx + WeekDemo. Five self-report questions cut to one. The old flow asked five and read back exactly one, and asked users to self-report about self-knowledge — the specific thing this product argues is unreliable. Replaced with a 30-day, 8-block heatmap of a fictional person: 240 outcomes that look like noise until the user taps one filter and the Gym row separates. 90% gym failure on days morning deep work LANDED versus 15% otherwise, against a 40% overall rate that reads as an ordinary failing habit. The continue button is gated on applying the filter, so the user pulls the signal out themselves before being told it exists. Data is hand-authored and verified; percentages are computed from the exact cells shipped, with an exception on each side because a perfect split reads as fabricated. The reveal states co-occurrence, never causation, matching the real engine's constraint. No AI call, no network, no claim about the user. THE CONDITION MUST STAY AN OUTCOME THE ENGINE ACTUALLY READS: a first version conditioned on the morning block "running past its window", which nothing computes — actual_end_minutes is captured but absent from every version of get_behavior_evidence, and the pack ships a caveat forbidding the narrator from claiming a block "ran until" a time. Completion of an earlier block is the real cannibalization trigger, so the demo now uses that. Likewise the contract screen says FlexMax "looks for patterns that repeat", not that it "checks every pair of blocks against every condition" — cannibalization tests one condition on tracked pairs, mixed days only, time-ordered, behind 8-day and 25-point-lift floors |
| Removed pile | today.tsx + planRestore. Removal was terminal — a block dropped to make room vanished with no way back. Now a third section under Accounted for, restorable. Restore routes through planRestore so it can never write the overlap 4a exists to prevent, and where the original slot is only partly free it offers to shorten the block rather than refusing. Only user and displacement removals appear: archive and away are system state, and restoring one would return a block whose template is archived or a block on a day the person is away. Muted X, never coral — a removed block is a decision, not a failure. Two supporting changes the pile does not work without: useTodayData stopped filtering 'removed' out of the day's instances (every consumer downstream — streak, completion rate, notification eligibility, occupiesTime — already filters status explicitly, so nothing else moved), and the swipe-to-remove handler now maps the row to 'removed' in local state instead of dropping it from the array, which had made restore unreachable until the next reload. MIN_BLOCK_MINUTES moved from the recovery route into schedule.ts and is imported by both, since a route file is the wrong home for a constant two screens share; restore searches the whole remaining day rather than only the original window: original slot at full length first, then any full-length slot via findRescheduleSlot, then the largest gap shortened. Full length beats original position — 90 minutes at 10pm is worth more than 45 at 1pm. Sleep is a hard bound at every tier via resolveDayEnd, and a relocate or shrink is always confirmed, never silent |
| Shorten and move | recovery/[id].tsx + planShrinkToFit / placeShrunkBlock in schedule.ts + DurationSlider. A single-collider sacrifice now carries a fallback beneath it: shorten the collider instead of removing it, minute resolution, defaulting to 50%. The COLLIDER shrinks, not the block being rescheduled — the missed block already lost its slot once, and compressing it too would mean the recovery costs the thing being recovered. Single target only: a slider per block across two or three colliders is a negotiation, which is the freeze this flow exists to avoid. maxMinutes is derived from the same gap set placeShrunkBlock's fallback pass searches, so every value the slider can produce is guaranteed placeable — a slider that can select an impossible duration is worse than no slider. Placement runs two passes, preferring a slot at or after the collider's own original start, because a plain earliest-fit search drops a shortened Cardio into a free hour AHEAD of the block it just made room for; the earlier gap is still taken when it is the only space left, and the sentence above the button always states the resulting time, so the fallback is never silent. original_start/end_minutes on the target records the pre-compression length; reschedule_count is deliberately NOT bumped there, matching push — the user rescheduled the missed block, not this one. Built on reanimated + gesture-handler rather than a slider dependency, per the interval stepper precedent. The thumb is positioned from the value prop, not from a gesture-driven shared value: there is nothing to animate, and a spring between finger and readout reads as lag. Horizontal intent only (activeOffsetX / failOffsetY) or the pan eats every scroll that starts on the track. Haptics are a detent at each rail, once per arrival — per-minute feedback is a buzz train, which reads as an alert. Push and shrink commit through one commitPairedMove helper, since both are "set two rows' times in one transaction, then provenance", and planRestore's gap walk was extracted to a shared freeGaps for the same reason: the occupiesTime postmortem is what happens when one rule keeps three copies |
| Past-day access | StreakStrip + useTodayData + 045. Long-press a square to open that day; horizontal pan on the strip pages weeks back to the first instance. View is unbounded; only yesterday can be filled in. A late check-in the next morning is accountability. Rewriting a week-old miss is covering for it. Generation, notification rebuild, pre-block nudge, and weekly-insight invoke are all gated to today: generating a past date would fabricate history, and scheduleTodayBlockNotifications cancels the managed set before rebuilding, so a past-day load would wipe today's notifications. Unaccounted rows appear in the open list on a past day (the sweep has already rewritten them); drag, swipe, swap, restore, and the recovery route are off — times are fixed, only the outcome can change, and the miss is taken in CheckInSheet rather than a reschedule flow that searches from now. Focus reload uses the viewed date, not today, or returning from a check-in would yank the user out of the day they are filling. AppState only reloads on a real date rollover. The backfill trigger (045) marks outcome writes after the row's own local date; paste it in the SQL Editor before shipping the client, because a marker protecting a metric must exist before the first backfill lands |
| Same-slot reschedule skipped | findRescheduleSlot. The missed row is excluded from occupancy, so its own window was a free gap and "Reschedule to this slot" could offer the time the block already occupied. That window is skipped; the search continues after it, and returns null (picker fallback) when nothing else fits |
| Stale check-in banners dismissed | scheduleTodayBlockNotifications. Cancel only hits the scheduled set. A "How'd it go?" that had already fired stayed in Notification Center after the block was completed. Presented banners whose instance is no longer pending/active are dismissed on every rebuild |
| Completion notes on check-in | CheckInSheet optional free text, written to reflection_improve. No chips — those are why capture was removed. Typed notes feed the existing "Last time you wrote" path |
| Shorten-template remedy | src/lib/remedy.ts + recovery. Same 4-of-7 floor as preempt/quality-drift. Offers half duration (not below 40 minutes to start, floor MIN_BLOCK_MINUTES). Copy states this changes the repeating block from tomorrow on, not today's miss. User confirms. Writes schedule_blocks.end_minutes so tomorrow generates shorter. Undo on the same screen writes the original length back. Headline is the option, not the miss count. Fixed blocks excluded. A later restore-after-quality-recovers offer is not built |
| Day selector and per-day times | schedule-builder.tsx + DayStrip + 046. The builder was a flat list of rules ABOUT the week, so the user reconstructed their week mentally; and a block held one time, so different times on different days forced a second block — which the engine already merged, since get_behavior_evidence groups by name. Tapping a day filters to that day, sorted by resolved time, and the time pickers then edit that day only. Defaults to All, not today: this screen is visited to set up a week, and starting on one day hides six sevenths of it. Adding a block while a day is selected defaults to that day. Archiving from a day view with an override asks whether to drop the day or the block, rather than guessing |







### Not built


| What                                            | Notes                                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Presence-aware nudges (block-start + mid-block) | The "smart notification suite". User requested this in their OWN reflections 3x: "harder cutoffs", "need enforcements", "maybe you can do something to help" |
| Shareable weekly recap card                     | The weekly scorecard. Growth primitive                                                                                                                       |
| Day-3 first observation                         | Still worth building — weekly-insight gates at engaged_days < 5 — but Stream 1 is the week-one value and does not require the engine to speak. No longer framed as plugging a gap. |
| Paywall + RevenueCat                            | Hard paywall $14.99/mo, fires after onboarding screen 7. Placement RESOLVED.                                                                                   |
| "Ask me about yourself" conversational surface  | Reads get_behavior_evidence with the narrator's tone rules                                                                                                   |
| reflection_improve UX fix                       | 31% fill rate on the highest-signal field in the DB                                                                                                          |
| External TestFlight                             | Needs Beta App Review (~1 day) + a demo account or auto-rejection                                                                                            |
| Device activity detection (Screen Time) | Policy-verified design: user self-selects distraction apps via FamilyActivityPicker → OPAQUE TOKENS, so FlexMax structurally cannot know which apps were chosen. Each focus block registers a DeviceActivitySchedule with a threshold event (e.g. 5 cumulative minutes); eventDidReachThreshold fires a local notification reusing the existing **Notification action buttons** (018 nudge_response) infrastructure. The extension records to an App Group store; the app syncs a minimal derived record only — drift occurred, duration bucket, response, block outcome. Never raw usage. NOTE: DeviceActivityReport data is render-only and not readable programmatically, so the threshold event IS the data model — and it happens to be exactly the intervention→response→outcome shape. CONSTRAINTS: entitlement is per bundle ID, main app AND every extension; unrequested extension IDs fail signing at distribution. Requires native Swift extensions — config plugin (react-native-device-activity) or prebuild. Approval takes days to weeks. See UNBLOCKED ACTION above. |
| Night routine block is hard to answer           | Excluded from the evening sweep (hasn't happened yet) and from bedtime notifications (by design). Drifts to unaccounted unless answered from Today. Candidate fix: a third question on the morning DayBoundaryCard |
| User instructions page                          | The streak rises on a day where everything was missed. The label qualifier was removed for width, so there is no in-app explanation. Owed |
| Onboarding demonstration beat | Onboarding establishes the pain (screens 1-2) and sets the contract (screen 7), but never shows what the product DOES. A stranger goes from "how many planners have you abandoned?" to a $14.99 wall without seeing FlexMax work. Fix: show a REAL generated insight, explicitly labelled as another user's, before the contract screen. Not a claim about them — a demonstration. See rejected approaches below |
| Showcase page carries the offer | docs/index.html has no pricing and no founding-member framing. With no trial it is the only pre-purchase evaluation surface, and most of the "is this enticing" work happens there and in the App Store listing, not in onboarding. See also **docs/index.html — rebuilt 2026-08-11** in Pricing & paywall below |


### Future build — leftover from the 2026-09-03 remedy triage

Accepted items from that pass have shipped (same-slot skip, stale banner dismiss, empty-Today pull hint, completion notes on `reflection_improve`, shorten-template remedy with going-forward copy and same-screen undo). The rest wait until shorten has been used on a real week. Do not start these to "complete the list."

**1. Earlier / later — the rest of the decision tree.**
Shorten is the one shipped option: lower the bar on the template. The original sketch also offered "schedule it earlier" and "schedule it later" when a block keeps slipping. Those are real, and they are a different search. Shorten writes `schedule_blocks.end_minutes`. A move writes the template's `start_minutes` (and end, same duration) against a *typical week*, not today's leftover gaps — `findRescheduleSlot` is a same-day salvage function and is the wrong engine. Build a weekday-aware slot search over the template plus today's occupancy, then offer at most one earlier and one later candidate the user confirms. Same rules as shorten: deterministic, same 4-of-7 floor, headline is the option not the miss count, no auto-apply, fixed blocks excluded. Do not ship a three-choice menu until shorten has accept/reject history.

**2. Restore length after quality recovers.**
The other half of "progressively overload." After a shorten lands, a run of `crushed` (or the quality-drift window flipping clean) should offer to put the original duration back. Same-screen Undo is not this — Undo reverses a tap you just made; restore is a later, earned offer. Needs the original duration stored beyond session state (`remedy.fromMinutes` dies when recovery closes). Do not auto-lengthen. Do not offer restore on a block that was never shortened by this path. A probation window ("try 30m for two weeks") is a second state machine; skip it until the simple restore has been used.

**3. Per-block quality standards.**
User-written bullets on the template: what "done" means for this block, shown at check-in so the rating is against their own bar. Sacred if displayed at the moment of rating; a leak if it becomes a form to fill at 11pm. No per-bullet scoring — that is a habit tracker. `task_detail` already holds today's intention; this is the standing definition, not the day's task. Defer until Gate 1 on `reflection_why` (and now optional completion notes) has a real-tester read. If fill is already thin, do not add another field.

**4. Do not replace `weekly-insight` with a bigger card.**
The complaint was right: restating "you miss Workout" is a slap, and the morning note is not the product. The fix is more *writes* (shorten shipped; earlier/later and restore above), not a smarter paragraph. Keep the weekly call as a small stored belief after `engaged_days >= 5`. If a line cannot attach to a confirmed structural option, it stays nudge-sized. Impressive means a change the user could not have computed in two seconds and can take. Text-only impressiveness rots into the same repetition.

**5. Mentor / founder story — listing and showcase only.**
Mentor-without-an-audience, the $200/mo contrast, "I built this for myself," and "solve my problem first" are App Store / `docs/index.html` voice. Not in-app copy. n=1 still does not prove adoption; the story may say it worked for the person who built it. It may not treat founder fill rate as evidence. Bundle with the pricing / founding-member pass on the showcase page, not with the remedy loop.


---


## Feature triage (2026-08-02)

Ideas evaluated from an external strategy session. Decisions and reasoning
recorded so they are not re-argued from scratch.

### Accepted — build

**1. The accounted-for streak (replaces the completion streak).**
The streak currently counts days with at least one `completed` block, so a bad
day accelerates toward the freeze — confronting the accumulated shortfall at
once is the historical uninstall trigger for this ICP, not the first missed
block alone.
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
UPDATED 2026-08-24: the target is now reflection_why alone. The
reflection_improve capture was removed rather than fixed, so the 31%
figure this paragraph cites no longer describes anything that exists.
Re-measure fill rate on reflection_why before deciding voice is warranted.

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

**An "extenuating circumstances" field that voids a miss.** Considered and
dropped 2026-09-01. This ICP is defined by reasons that feel legitimate from
the inside; a button that voids a miss makes every uncomfortable miss
extenuating, and the engine goes blind exactly where it is most useful. The
streak already counts a miss as alive, and the "Something came up" preset
records an external cause without the exemption.

---

## UI depth — diagnosis and build order (2026-08-08)

Audit of the Today screen and its components against the design language.
Verdict: the UI reads as static and generic. The cause is NOT that the design
language is too restrained. The cause is that restraint was implemented as
absence.

### The distinction that governs this work

"Static" and "generic" are two separate problems and neither is fixed by
decoration. The no-gradient / no-glow / no-emoji / no-celebration-animation
rules stay binding and are not relitigated here. Elevation is shadow-based in
light and luminance-based in dark — `shadowRest` / `shadowLift` tokens in
theme.ts. Shadows apply to cards and sheets only; the no-shadow rule still
holds for nested surfaces, inputs, rows inside cards, and controls in both
modes. If everything floats, nothing does.

What was conflated: **flat is not motionless, and restrained is not
low-contrast.** Apple's restraint is heavily motion-driven. Porsche's restraint
is proportion and material, not emptiness. Having forbidden ourselves color,
ornament, and depth, the remaining differentiation axes are TYPOGRAPHY, MOTION,
HAPTICS, and PROPORTION — and as of this audit all four are untouched.

If a future session tries to fix "generic" by adding gradients, glow, accent
colors, or celebratory animation, it has misdiagnosed the problem. The fix
direction is physical feedback and typographic hierarchy, not visual noise.
Card and sheet elevation in light mode is the one permitted shadow use.

**Block card shadows: the working recipe (2026-08-09).**
Block cards DO have light-mode shadows. A first attempt broke drag-to-swap and
was reverted; the second worked. The constraint is real but surmountable.

`cardWrapper` cannot cast a shadow itself: `overflow: "hidden"` (needed for the
swipe reveal) sets `clipsToBounds` on iOS, which clips the layer's OWN shadow,
and it has no `backgroundColor` — the fill lives on `slidingRow` inside it. iOS
derives the shadow path from the background, so a transparent view casts nothing.

The shadow therefore lives on a new outer `cardShadow` wrapper. THREE properties
must move to it together, and the first attempt failed by moving only some:
  - `onLayout` — MUST move. Left on `cardWrapper` after wrapping, its `y` is
    reported relative to the new parent instead of the list container, so every
    value in `cardPositions` goes to ~0 and `findSwapTarget` resolves against
    meaningless geometry. This is what broke swap.
  - `zIndex` — MUST move. Wrapping creates a new stacking context, so a `zIndex`
    on the inner view cannot raise a dragged card above its siblings.
  - `marginBottom` — moves, so the outer wrapper owns list spacing.
`wrapperAnimatedStyle` keeps `translateY` and `scale` only.

The wrapper's `backgroundColor` is driven by DISPLACEMENT, not by `isDragging`.
`isDragging` resets on release while `translateY` is still animating home, which
repaints the wrapper's fill under a card still in flight — a blank card flashing
after every drag and swap. Interpolate on `Math.min(Math.abs(translateY)/4, 1)`
instead. It is self-correcting and has no timing to keep in sync.

Motion added under this section is STATE TRANSITION and PHYSICS — a status
changing, a card settling, a list reflowing. It is not celebration. The
no-confetti / no-cheerleading rule is unaffected.

### Evidence found in code

- `expo-haptics` is not in `apps/mobile/package.json`. There are zero haptics in
  the app. Every check-in, swipe-open, swap commit, rating tap and sheet
  dismissal is silent.
- `expo-font` is absent and no `fontFamily` appears anywhere. All type is system
  SF at default weights.
- `theme.ts` defines a `typography` scale that `BlockCard.tsx` ignores —
  `fontSize: 16 / 14 / 13` and `fontWeight` are hardcoded in its StyleSheet.
  The scale is not internally consistent.
- 16 text glyphs are used as icons across components: `🔒` ×4, `✕` ×6, `✓` ×3,
  `→` ×2, `⠿` ×1. The four lock emoji directly violate the standing "no emoji
  anywhere in the UI" rule and render in full color on a deliberately greyscale
  screen. `@expo/vector-icons` ships with Expo — no new dependency required.
- No state transitions. Check-in snaps the status bar color, circle fill and
  border instantly. Swaps teleport. Removals jump. Reanimated 4 is installed and
  barely used.
- The only block-card animation is a border that blinks 5× (`triggerFlash`),
  which reads as a validation error rather than a confirmation.
- All press feedback is stock `TouchableOpacity` opacity.
- Drag lift is imperceptible: `scale: 1.03` is below threshold, and the
  accompanying `elevation: 8` is Android-only, so a dragged card does not lift
  on iPhone at all.
- Greyscale stack runs a 13-point luminance gap (`#DCDCDC` background /
  `#EDEDED` surface) with a 0.5px border.

### Build order — one commit each, in sequence

| # | Work | Status |
|---|------|--------|
| 1 | Haptics vocabulary + 8 sites | SHIPPED |
| 2 | Feather icons, 17 glyphs purged | SHIPPED |
| 3 | Typography scale, tracking, tabular figures | SHIPPED — system SF, no custom face |
| 4a | Card state transitions | SHIPPED |
| 4b | List reflow animation | REJECTED — see below |
| 5 | Press feedback across buttons and rows | SHIPPED |

### Rejected — do not re-propose

**4b, list reflow animation (2026-08-09).** Animating card positions after a
swap or removal buys roughly 300ms of glide on an action that already carries a
haptic, a toast, and a highlight wash. The cost: `findSwapTarget` resolves drop
targets from `cardPositions`, populated by `onLayout` on the card wrapper.
Layout animation requires moving `onLayout` to a new outer wrapper that reports
geometry mid-flight, and layering a `layout` transition onto a view that already
carries the drag transform. Low value against real risk to the most-iterated
logic in the app. REVIVAL CONDITION: only if list mutations become frequent or
large enough that jumping reads as a bug rather than a non-event.

**Drag shadow exception (2026-08-09).** Resolved as part of light-mode elevation.
`shadowRest` on cards at rest; `shadowLift` interpolated during BlockCard drag.
Dark tokens carry `shadowOpacity: 0` — elevation stays luminance-based there.
Physics affordance, not decoration; light-mode only.

**Custom typeface (2026-08-08).** System SF with disciplined tracking, a
collapsed 7-step scale, and tabular figures closed the gap. A custom face would
add licensing, font loading, FOUT in Expo Go, and bundle weight. The token layer
makes it a one-line swap in theme.ts if ever revisited.

### Still open

- **hapticCommit placement.** Fires after the swap RPC returns, contradicting the
  rule in haptics.ts that haptics confirm input, not network results. Moving it
  earlier closes a perceptual dead zone but makes a small optimistic promise,
  cutting against the rule that optimistic UI only applies after a successful RPC.
- **Status stripe inset.** Sits ~14px short top and bottom because cardBody has
  padding: 14. Full-bleed is a different fix (absolute positioning).
- **Six duplicated sheet close buttons.** Want to be one SheetCloseButton.
- **Reschedule bound uses intent, not behaviour.** findRescheduleSlot bounds the
  day by profiles.sleep_target_minutes (stated intent). day_log.slept_at records
  what actually happened. Whether it should use observed behaviour is a
  behavioural-engine question.
  SUPERSEDED 2026-08-24: day_log.slept_at is no longer being collected, so
  there is no observed-behaviour series to switch to. This reopens only if
  sleep observation returns with a consumer attached.
- **swap_drift cannot separate swaps from reschedules.** A swap writes one
  instance_time_changes row per participant, so a single event appears twice
  with opposite directions and roughly doubles aggregate move counts.
  Directional claims may be one observation seen from both sides. txid already
  groups both halves; splitting swap-derived moves from solo reschedules is
  pure SQL and should land before any insight cites drift direction.
- **Swap still dead-ends on collision.** handleSwap refuses with a toast and
  offers nothing, while reschedule now resolves. The asymmetry is deliberate
  for now: in a reschedule the user chooses the destination, so "displace
  what's there?" is a coherent question; the anchor-rebuild swap computes a
  position the user never picked, so the same offer would be confusing. The
  likely fix there is showing resulting times BEFORE committing, not a
  displacement offer.
- **A displacement is indistinguishable from a swap in the audit trail.**
  Reusing swap_instance_times means the trigger writes both rows under one
  txid, exactly like a swap. This compounds the existing "swap_drift cannot
  separate swaps from reschedules" item — there are now FOUR event types
  sharing one signature, since shorten-and-move commits through the same
  RPC. A compression is the one recoverable case: the shortened row carries
  original_start/end_minutes spanning a longer window than its new times,
  which nothing else produces. Length change is therefore separable in the
  data even though direction is not.
- **quality_drift's window moved from 5 to 7 rated instances (029).** The
  in-app degradation prompt and the evidence pack now share one definition of
  "degrading", so the app cannot ask about a block the weekly insight never
  mentions. recent_poor and recent_rated will report different numbers than
  any insight generated before 029 — the meaning is unchanged, the sample is
  larger. Insights generated before 2026-08-25 were also built on pre-027
  swap_drift, so the first fully clean set is the one after both.
- **Timezone is displayed but not editable.** profiles.timezone drives
  v_today in get_behavior_evidence and the whole nightly sweep. A user who
  moves cannot correct it. Deliberately excluded from the profile-page work
  because changing it retroactively reinterprets every stored date, and the
  right behaviour for existing history is not obvious.
- **No nudge frequency control.** Cutoff nudges fire automatically with no
  off switch. CLAUDE.md's "nudges must be earned and specific" argues the user
  should be able to turn them down; without that, the only available action is
  killing notifications at the OS level, which silently disables everything.
- **quality_reason_note is captured but not returned.** Nothing reads it
  and nothing shows it back. A free-text field that visibly changes nothing
  is a suggestion box and erodes trust once the user notices. The intended
  return path is the recoveryCopy.lastIntention mechanism — surface the
  user's own note the next time that same block is in trouble. Until that
  ships, this column is capture without consumption, which is what got
  day_log removed.
- **Wake is now load-bearing.** It is how resolveDayEnd detects a midnight
  crossing. Per-day overrides live in DayBoundariesSheet; the header/footer
  split was kept deliberately so Wake and Sleep still frame the block list as
  a timeline.
- **miss_reason_tag is only captured in the evening sweep, and that is
  deliberate.** A user who swipes to declare a miss during the day is being
  intentional and writes reflection_why; a user resolving misses at 9pm has
  only a tap left in them, which is what the presets are for. Two capture modes
  matching two engagement states. The consequence is that miss_reasons
  describes END-OF-DAY misses specifically, not misses in general, and the
  evidence pack does not currently say so.
- **Migration files have drifted from remote before.** 034 through 037 were
  applied to the database and shipped as app code with no matching migration
  files, and were only caught by chance. The table in this document is the only
  record of what is deployed. Any manually applied SQL must be committed in the
  same session it is run.
- **No migration file holds the current get_behavior_evidence definition.**
  033 and 038 both rewrite the deployed function in place via
  pg_get_functiondef rather than redefining it, so the live body exists only in
  the database. That was the right call — it prevents ~300 unrelated lines
  drifting — but it means reconstructing the function from files alone is no
  longer possible. Dump it with pg_get_functiondef before any future edit.
- **The pre-block nudge is not tone-aware.** accountability_tone (firm /
  gentle / data-driven) shapes the weekly insight but not notifications. A
  data-driven user probably wants the raw ratio and a gentle user probably does
  not want a count at all. Cheap to add — the client already has the profile.
- **Watch whether the pre-block nudge helps or discourages.** It arrives at
  the moment of decision and reports a poor record. The counts-what-landed
  framing is a hedge, not evidence. nudge_events already captures fired-versus-
  completed for cutoff nudges; the same instrumentation on block_preempt would
  answer this directly, and until it exists this feature is a hypothesis.
- **Three notification types, still no off switch.** Nudge frequency control
  was already open before this; a third type makes it more pressing. The only
  action available to an annoyed user is disabling notifications at the OS
  level, which silently kills everything including the cutoff nudges that have
  measured response data.
- **Timed adhoc tasks are not in the Accounted for section.** They keep
  their existing in-place completed state, so a completed adhoc stays in the
  timeline while a completed block moves down. Consistent treatment needs a
  decision about whether adhoc completion means the same thing as block
  completion.
- **No maturity gate on tracked.** 039 reports block age but does not act on
  it — a block with three days of history still enters block_stats,
  quality_drift and cannibalization, held back only by a caveat. A hard floor
  in the tracked CTE would be stronger, but would also silence a genuinely
  failing new block, so the facts are reported and the narrator is instructed
  rather than gated. Revisit if the caveat proves insufficient.
- **A dead network costs up to 10 seconds of spinner before any feedback.**
  The auth bootstrap timeouts are 10s each, so a user with no connection
  watches BrandLoader for the full duration before the error screen appears.
  Correct for a slow connection, poor for no connection. A shorter first-attempt
  timeout with a retry would feel better, but distinguishing slow from dead
  needs care — do not shorten it blindly.
- **block_exceptions still has no UI.** 042 covers the common case — a
  user-level absence — but per-block skip ("no gym next Tuesday", keep
  everything else) is reachable only from SQL. The table exists and
  generation honours it.
- **starts_on has no UI, deliberately.** Blocks always start immediately,
  matching how Apple Calendar treats a repeat rule: the event's own date is
  the start. A programme beginning next month is a real case but wants its own
  design, not a second date picker on this sheet.
- **Blocks can still not cross midnight.** schedule_blocks.valid_time
  constrains end_minutes <= 1440, so an 11pm-1am block is unrepresentable at
  the template level. This is a schema constraint, not just a rendering
  problem, and it blocks night-shift schedules and sleep-as-a-block.
- **Safe-area insets are handled on the schedule builder only.** Every other
  screen renders without them. react-native-safe-area-context was a dependency
  with no call sites until now, so anything pinned near a screen edge elsewhere
  may sit under the home indicator.
- **RRULE INTERVAL and our generation math can disagree.**
  generate_daily_instances computes weeks as (target - anchor) / 7,
  anchor-relative. RRULE counts INTERVAL from DTSTART's week boundary per
  WKST. Setting DTSTART to the anchor's first occurrence aligns them in the
  common case, but a block whose days span the week boundary can diverge, so
  a biweekly block may show on a different week in the calendar than in the
  app. WKST is fixed to MO for determinism. Reconciling properly means either
  changing generation to be week-boundary-relative or emitting explicit RDATEs
  instead of an RRULE.
- **The feed is rate-limited per known token (60/hour), via the same
  ai_rate_limits table as weekly-insight.** Unknown tokens still 404 without
  incrementing, so a 429 cannot confirm the space. Platform-level / IP
  limiting on the 404 path is the remaining gap, and guessing a 48-character
  token is already impractical.
- **A swap or reschedule never reaches the calendar.** The feed publishes
  the template deliberately: Google refreshes every 12-24 hours, so publishing
  daily instances would show a Google subscriber yesterday's arrangement all
  day. Someone who swaps often will see a calendar that is persistently
  slightly wrong. Currently handled with a sentence in the UI. A hybrid feed —
  instances for the next few days, template beyond — would close it, at the
  cost of reintroducing staleness for Google specifically.
- **Four psychology_profiles columns are now unwritten as well as unread.**
  planners_abandoned, past_failure_mode, peak_energy_times and
  motivation_style remain in the schema and the type; new users will have them
  null. Either wire a consumer or drop them. peak_energy_times is the
  interesting one — findRescheduleSlot already scores candidate slots, and
  preferring one inside a stated peak window would make that answer visibly
  matter the first time someone reschedules.
- **Onboarding has no paywall because there isn't one.** handleStart still
  routes to the schedule builder. The contract screen is where the paywall
  goes once RevenueCat lands.
- **Calendar export ignores time_overrides.** calendar-feed emits one
  VEVENT per block using base start_minutes/end_minutes, so a block with a
  Saturday override reports the wrong Saturday time to every subscribed
  calendar. Fixing it means splitting such a block into multiple VEVENTs with
  disjoint BYDAY sets. Until then the feed is silently wrong for any block
  with an override.

---

## Theme system (2026-08-08 / 09)

Light and dark both shipped. `lightColors` / `darkColors` in theme.ts, `Colors`
type, `ThemeProvider` with three-way System/Light/Dark persisted to AsyncStorage,
`useTheme()` hook. Every styled file uses `makeStyles(c)` under `useMemo`. The
static `colors` alias has been deleted — a file reaching for a static palette
now fails to compile rather than silently rendering light on a dark screen.

`Colors` is a mapped type (`{ [K in keyof typeof lightColors]: typeof lightColors[K] }`), NOT
`typeof lightColors`. Under `as const` the latter would make values literal
types and darkColors could not compile with different hex. The mapped type keeps
key-completeness enforcement while preserving each token's value type — strings,
shadow objects, etc. — so a missing dark token is a compile error.

### Palette reasoning — do not undo without reading this

**Warm neutrals, not cool grey.** The brand mark is already warm (menuBarCoral
#CE7358, danger #D9694A). Cool-grey neutrals were in quiet discord with it.

**Not pure black.** Evaluated and rejected. On #000 the ink bar of the tricolor
mark disappears, `surfaceDim` has no room to sit below the background, and pure
white text halates. Warm charcoal preserves all three.

**Dark ladder sits at L\* 9 / 15 / 20 / 27** (surfaceDim / background /
surfaceNested / surface) with 4-7 point steps. The original sat at L\* 5-14 with correct
*perceptual* step sizes matching light — but display black-crush and ambient
light reflecting off the glass add a luminance floor that swallows small
differences at the bottom of the range. Lifting the ladder off that floor forced
every border and low-contrast text token up with it, or they collided.

**Surface order — RESOLVED 2026-08-09.** Both modes now run
dim < background < nested < surface. Dark sits at L\* 9.0 / 15.3 / 19.7 / 26.5.
Surface separation was widened from 6.8 to 11.2 L\* while holding the background
fixed — the background must NOT be raised further; at L\* 15 it is already
brighter than Material, GitHub, and Linear dark modes.
  dark   dim 9.0  <  bg 15.3  <  nested 19.7  <  surface 26.5
  light  dim 88.0 <  bg 92.7  <  nested 95.1  <  surface 97.5
Nested elements read as recessed in both modes.

Tints and rating fills sit at ~L\* 20, deliberately recessed from surface. At
their previous L\* 24 they fell within 2.5 points of the new surface and the
check-in sheet's rating buttons lost their fills entirely.

**Light brightened 2026-08-09** from L\* 87.6 to 92.7 background, tint halved
(25.6% to 12.5% saturation on surface). The original #DCDCDC was eight points
below iOS's own light-mode background; the warm re-skin inherited that luminance
ladder unquestioned and added tint on top, which read as muddy.

**Rating neons are byte-identical across both modes.** #00C853 / #FFD600 /
#FF1744 are signal vocabulary, not decoration — the block card status bar
depends on matching the check-in sheet exactly, so the sheet acts as the legend
for the card. The rating *text* tokens do differ by mode.

**menuBarInk inverts** (#2B2822 light, #EAE5DC dark) or the tricolor brand mark
loses a stripe on a dark field.

### Measure surface separation in L\*, not WCAG contrast ratio

WCAG ratios are built for text legibility and compress badly at the dark end.
Equal ratios do not mean equal perceived separation. Use CIELAB L\* for any
surface, border, or elevation decision. Benchmarking dark against light by
contrast ratio produced a wrong "this is fine" conclusion once already.

---

## Components and dependencies added (2026-08-08 / 09)

New dependencies: expo-haptics, @expo/vector-icons (Feather), react-native-svg.
All bundled in Expo Go — no EAS rebuild required for any of them.

New components:
- `src/lib/haptics.ts` — named semantic haptic vocabulary. Never call
  expo-haptics directly from a component. Haptics confirm INPUT, not network
  results: fire at the tap, never after an await. No repeating haptic patterns —
  a buzz train reads as an alert, not a confirmation.
- `DragHandle` — six dots drawn as Views. The drag grip is texture, not
  iconography; also removes a braille character that was a font-rendering
  liability.
- `PressableScale` — press feedback with two variants. `scale` for
  button-shaped controls, `highlight` (animated background wash) for row-shaped
  controls, because a full-width row shrinking on touch looks like the layout is
  breaking. CRITICAL: the style prop must land on the Pressable itself, never on
  an inner Animated.View — layout properties (flex, width, alignSelf) applied to
  a child are invisible to the parent, which broke the appearance segments.
- `BrandMark` — the F mark as themed SVG, drawn from the same three brand
  colors as MenuButton. Geometry measured from assets/icon.png.
- `BrandLoader` — the mark with opacity travelling through blue, ink, coral on a
  660ms cycle, floored at 0.35 so the F stays legible. Used on the six
  full-screen loads only; the eleven inline button spinners stay as
  ActivityIndicator, since at 200-400ms a branded animation renders as a flicker.
  THE LETTERFORM MUST NEVER ROTATE. An asymmetric glyph spends most of a
  rotation upside down and reads as having fallen over.

**Completion quality is a traffic light, not a saturation ramp (2026-08-09).**
The block card status bar shows crushed/partial/pulled_away as teal / #FFD600 /
#FF1744, matching the check-in sheet exactly. Claude argued for a single-hue
saturation ramp on bad-week grounds; Belal overruled on the grounds that a
three-step ramp on a 4px stripe is illegible and the point is instant
interpretation. Belal was right.

**Back navigation pops, it does not replace (2026-08-09).** `router.replace()`
swaps the top route but leaves the entry beneath, so every round trip added a
permanent stack layer. Use `router.back()`. EXCEPTION: the notification response
handler in _layout.tsx must stay `replace` — it fires on cold launch where there
is no stack to pop.

**userInterfaceStyle: "automatic" (2026-08-09).** Required in app.config.ts or
Expo defaults to "light" and pins the app natively, so useColorScheme() never
follows the OS. UNVERIFIED: Expo Go supplies its own native config, so this
cannot be tested there. Must be confirmed on an EAS build before shipping dark
mode.

**reflection_improve chips (2026-08-09).** Five structural presets plus a
"Something else" text escape hatch, writing their own label as a string into the
existing column. No schema change — but the data's character changed from
all-unique freeform sentences to mostly six repeated strings.
ARCHITECTURE CHAT MUST DECIDE: whether get_behavior_evidence() and the weekly
insight should weight canned answers differently from typed ones. Eight
instances of "Start earlier" may reflect a real pattern or just the easiest chip
to tap. Cheaper to decide before the data accumulates.

**All modals slide, none fade.** `animationType="none"` with scrim opacity and
sheet translateY animated together, ~220ms open with `Easing.out(Easing.cubic)`,
~180ms close. The sheet stays fully opaque — animate the scrim's opacity and the
sheet's position, never the sheet's own opacity.

**Undo is not destructive.** The undo sheet's primary action uses `c.text`, not
`c.danger`. Coral is reserved for Remove ONLY — Missed uses `c.primaryTint`
(BlockCard.missedBtn, CheckInSheet.missedBtn), because admitting a miss is
engaged behaviour the accounted-for streak protects, not a destructive act.
This matches the streak rule that the missed segment must never be coral.
Undoing a completion is a correction.

**Check-in transition runs at 400ms** with the icon scaling 0.5 -> 1 on
`statusFade`, so the fill and unfill are both perceptible. Never exceed scale 1 —
overshoot reads as celebration.

**Light shadows:** `shadowRest` at 0.20 opacity, `shadowLift` at 0.32, both zero
in dark. Elevation is shadow-based in light and luminance-based in dark, because
a shadow is darkness cast on a surface and at L\* 15 the dark background has
nothing darker to receive it. Every shadowed view needs an explicit
`backgroundColor` or it casts nothing on iOS.

---

## Design rules

**Any function that sets a loading flag must clear it in `finally`.**
`useTodayData`'s load set `loading` true, then threw at
`await generateDailyInstances()` before reaching `setLoading(false)`, locking the
Today screen on a spinner permanently with an unhandled rejection. Recurred
2026-08-26: the same hole reopened because the clear lived on a later line
rather than in a finally, so any throw or hung RPC before that line locked the
screen again. It is now structurally guarded — `setLoading(false)` lives in
`finally`, and `generateDailyInstances` is raced against an 8s timeout so it
cannot hold the load indefinitely. Also give
failed loads a distinct retry state — a failed load rendering the empty state
tells the user they have no blocks, which is a worse lie than an error.

**Do not reload on every focus or AppState change.** `useFocusEffect` fires on
any focus regain, including after a Control Center swipe — which is how airplane
mode is toggled. Gate on date change or elapsed time. Gate AppState on
`background -> active` only; iOS emits `inactive` for Control Center, the
notification shade, and the app switcher.

**A console error is not a user-facing bug.** Four commits were spent chasing a
logged network failure that no user could see. The bar is: does the screen stay
usable and does the user's intent survive. Not: is the debugger clean.

- **Reward closure, not outcome.** The reflection is the intervention, not the
  data collection — value lands at the moment of writing, not a week later. The
  felt payoff is having accounted for the day, which is why the two-tone square
  fills regardless of whether the block succeeded. Streaks that shatter,
  confetti, variable reward schedules, and notification pressure are engineered
  for compulsion, and compulsion is fragile in this population. Same
  neurochemistry, opposite failure mode.
- **Strengths open an insight set; they are not a balancing item at the end.**
  "You confronted this one every time, including when it went badly" is a
  sentence only this architecture can produce. Lead with it.
- **Never promise passivity.** The product is specifically engineered to notice
  when the user didn't follow through. Copy that implies the outcome arrives
  without effort sets up the exact user who churns hardest — someone who paid,
  didn't work, and got shown a miss. The honest promise is the opposite and it
  is stronger: *this is the system that doesn't quit on you when you quit on
  yourself.*
- **Distinguish sacred from incidental friction before removing any.** See
  `What the product actually does`. Contact with one's own data is the
  mechanism; the input method is not. Removing a keystroke is fine. Removing a
  look at the schedule is not.

---

## Known issues

**Offline write queue — attempted and reverted (2026-08-09).**
A write queue with an AsyncStorage-backed retry buffer was built, documented,
and reverted the same day. Two failures compounded: (1) transport errors were
never detected, because supabase-js catches fetch failures internally and
returns them as `{ error }` which callers rethrew as PLAIN OBJECTS — the
`instanceof Error` checks in `isTransportError` all returned false, so every
offline write was rolled back instead of queued; (2) the global fetch timeout
was lowered to 5s to reduce offline stalls, which also governed Supabase auth
token refresh, so a slow cold-start refresh aborted and the app failed to
open at all.

The feature shipped, was documented, and never worked once — it was never
tested with the network actually off. Preserved on branch
`offline-queue-attempt`. If revisited: auth and data need separate timeouts,
transport detection must handle plain objects (PostgREST errors carry a
populated `code`; transport failures do not), and the airplane-mode test is
the acceptance criterion, not a nice-to-have.

**cannibalization detection took three attempts, each failing differently.**
Comparing days the trigger FAILED found whole-day collapse, not trade-offs —
on a collapse day every pair co-fails. Adding a mixed-day restriction
surfaced time-of-day clustering instead, including an impossible pair where a
7am block appeared to cause a 6am failure. The working version inverts the
trigger: cannibalization is one block SUCCEEDING while a later block fails,
because the aggressor wins and takes the other's time. Requires mixed days and
strict time ordering. Currently produces a directionally correct result
(Morning Deep work is the sole trigger, matching reflections and swap_drift)
on very thin evidence — a 2-event difference. Treated as corroborating
evidence only.

**Evidence restated 2026-08-24 (027).** The cited swap counts — Cardio 29,
Weights 11, Morning Deep Work 3 — were produced by a metric counting edit
ROWS, not moves. An audit found 817 logged changes resolving to 45 net
moves. Clean figures: Cardio 9, Weights 9, Morning Deep Work 5. The
corroboration holds, but the supporting fact is different than stated. The
5-vs-9 spread is too narrow to support "everything reorganizes around the
block that never moves." What the clean data does show is directional and
strong: Cardio moved later in 8 of 9 moves, averaging ~5 hours, while
Morning Deep Work moved later in 5 of 5, averaging ~4.6 hours. Per the
user's own account the mechanism is an oversleep cascade — the morning
session is pushed forward, the afternoon session is pulled earlier to fit
alongside it (6 of 9 moves earlier), and Cardio absorbs the displacement.
Cardio-as-sacrificed is better supported by displacement direction than the
immovability argument ever was.
Sharpened 2026-08-26 on post-033 data: Cardio now moves later in 7 of 7
moves and Morning Deep Work in 6 of 6, both with zero earlier moves,
averaging 313 and 265 minutes. Deep work afternoon remains the only block
skewing earlier (6 of 10). Perfect unidirectionality on both anchors of the
oversleep cascade is stronger corroboration than the mixed figures this
paragraph originally cited.

These came from an independent code review and should be verified against the
tree before being acted on — do not assume all are still present.

- **CI was red for every push after 2026-08-25.** The jobs themselves were
  fine (`typecheck` + `test` since 08-22). `away_periods` was added to the
  handwritten `Database` type as `Row: AwayPeriod` instead of
  `AwayPeriod & Record<string, unknown>`. An interface has no implicit index
  signature, so that one table failed postgrest-js's `GenericTable`, which
  failed `GenericSchema`, which collapsed every `.from()` / `.rpc()` to
  `never`. Two honest missing-RPC errors became 87 noise errors, and the
  signal stayed buried. FIXED 2026-09-02: the intersection is on the row,
  `behavioral_insights` / `nudge_events` / `delete_my_account` /
  `record_app_open` are in the type, and the five `as typeof supabase`
  casts that existed to paper over missing tables are gone.
- **`schedule-block-notifications` is still deployed.** Source was deleted in
  `fe76e9d` and the local directory is empty, but the project still 401s at
  `/functions/v1/schedule-block-notifications` (gateway JWT, `sb-error-code:
  UNAUTHORIZED_NO_AUTH_HEADER`). The four other deleted functions 404 at the
  platform. Delete it from the dashboard; nothing in the app calls it.
  request (Expo wants batches of ≤100). No ticket/receipt handling, so
  `DeviceNotRegistered` tokens are never pruned. No idempotency key, so a cron
  retry double-notifies.
- **README architecture diagram fan-out drifted.** `behavioral_insights` feeds
  the Today card and weekly-recap. Plan Tomorrow does not read the table.
  missed-block-recovery no longer exists.
- **No data export path.** Account deletion shipped (031 + account.tsx). Apple
  also wants a way for the user to obtain their data. Still a launch item.
- **Undecided:** README vs CLAUDE.md as the canonical reasoning log. They
  currently overlap.
- **`weekly-insight` leaks internals on error.** The catch at
  `supabase/functions/weekly-insight/index.ts:265` returns
  `JSON.stringify({ error: String(err) })` to the client with a 500. Any
  Postgres error text, RPC name, or stack fragment reaches the app. Should
  return a generic message and log the detail server-side. Nothing depends on
  the current shape — `useTodayData` invokes this fire-and-forget and ignores
  the body.
  FIXED 2026-08-26. The catch now logs the error server-side and returns a
  generic "Insight generation failed". Fixed alongside a larger gap: the
  function had NO console output at all, on any path, so a failing invocation
  produced only boot and shutdown lines in the dashboard and could not be
  diagnosed. All five failure returns and both success returns now log.
  The JSON-parse failure path still returned `String(parseErr)` until
  2026-09-02, when it joined the same generic return. A `sanitizeInsights`
  check now drops items that are not objects with a known `kind` and string
  `belief`/`evidence` before `replace_behavioral_insights`; an empty set
  after sanitizing is a 500, not a write. Length caps match the prompt.
  This is still not a JSON schema.
- **No database guard against inverted blocks.** `daily_schedule_instances`
  has no CHECK constraint on `end_minutes > start_minutes`; migration 025
  constrains `status` and `completion_rating` only. Postgres would accept a
  block that ends before it starts and the day render would break. Three
  client-side guards currently carry this: the add-block check in
  `schedule-builder.tsx`, the edit-block check, and the `MIN_BLOCK_MINUTES`
  clamp in the recovery route's end-time picker. A CHECK constraint would make
  all three backstops rather than the only defense — but it would need to
  tolerate existing rows, so verify no inverted rows exist before adding one.
- **`removed` now carries two meanings.** User-deleted and displaced,
  distinguished only by `displaced_by_id`. Any query filtering on status
  `'removed'` will return more rows than a reader expects.
- **CORRECTED 2026-08-26.** The "0 entries before and after" measurement was
  wrong — almost certainly a null or wrong user id, which makes
  get_behavior_evidence return empty arrays for every key. Verified against
  the live function on 2026-08-26: swap_drift returns six blocks with
  times_moved 6-10 and average displacements of 73-313 minutes. The signal is
  live and 033's filter is doing real work; only the impact assessment was
  wrong. Process note: an empty result is not a passing test. "The fix had no
  effect and the input was also empty" indicates a broken measurement, not a
  harmless change — the same failure mode as the offline-queue postmortem,
  where the acceptance criterion was never exercised.

**A post-midnight bedtime disabled rescheduling entirely (fixed 2026-08-26,
035).** dayEnd was `sleepTargetMinutes ?? 1440` in both findRescheduleSlot
and planDisplacement. A 1am bedtime stores 60, so `end > dayEnd` rejected
every slot after 1am — which is all of them. Reschedule proposed nothing and
every displacement reported past-bedtime. resolveDayEnd now detects a
boundary crossing midnight (sleep <= wake, or below 4am when no wake is set)
and clamps to 1440, because instances are minutes-since-midnight on a single
date and no slot past 1440 is representable. Latent since 020; per-day
overrides would have made it common.

**Deleting a schedule block destroys its behavioural history (guarded
2026-08-26).** daily_schedule_instances.block_id is `on delete cascade`, so
removing a block permanently deletes every instance — completions, misses,
ratings, reflections, quality tags, miss reasons. It shipped with no
confirmation, one tap from a card. Now behind an Alert naming the specific
cost. The underlying problem stands: there is no way to retire a block
without destroying its record, and no start/end date on a block, so a user
finishing a fixed-length programme must choose between a dead block
cluttering every day and losing the data. Archiving (is_active on the block,
excluded from generation but retained for the evidence pack) is the real
fix.

**Restoring an archived block did not return it to Today (fixed
2026-08-26).** Archiving marks today's pending instance 'removed'; restore
only flipped is_active. The stale 'removed' row then blocked regeneration,
because generate_my_daily_instances is `on conflict (block_id, date) do
nothing` — the row existed, so nothing was inserted. Reset Today was the
only way back. Restore now generates first (covering a restore on a later
day, where no row exists at all) and then clears the tombstone, scoped to
today and to status 'removed'.

RESOLVED 2026-09-01 (044). The limitation logged here — that 'removed' is
also written by the user's own "Remove from today", so restoring a block
manually removed earlier the same day would bring it back — needed
provenance on the status change, and removed_by now supplies it. Archive
restore scopes its clear to removed_by = 'archive' and leaves a hand-removed
row alone.

**Removing an away period did not restore today (fixed 2026-08-31).**
Creating a period covering today marks today's pending instances 'removed';
deleting it only deleted the away row. The tombstones survived and blocked
regeneration, because generate_* is `on conflict do nothing`. Reset Today was
the only way back. This is the SECOND time this exact pattern shipped — block
archive restore had it identically (b83cb41). Any feature that suppresses
instances by marking them 'removed' must undo both halves: generate first
(covering a suppression created on an earlier day, where no rows exist at
all), then clear the tombstones.

RESOLVED 2026-09-01 (044), same fix as archive restore. Cancelling an away
period no longer restores blocks the user had removed by hand — the clear is
scoped to removed_by = 'away'. Both halves of the undo still apply: generate
first, then clear only this path's own tombstones.

**Close-today's "skip" link read as cancel (fixed 2026-08-26).** Tapping
Missed committed status='missed' immediately; the chips that followed offered
a "skip" link that only called setPresetsDismissed. Users read it as backing
out of the miss. Because closeTodayVisible filters to
pending/active/awaiting-preset, the row then disappeared and a mistap was
unrecoverable without Reset Today. "skip" is now "No reason", and a "Not
missed" action reverts the row to pending and clears the tag.

**Close-today wrote a miss before the user finished declaring it (fixed
2026-08-26).** Tapping Missed committed status='missed' immediately, then
showed reason chips. Leaving the screen at that point — closing the sheet,
backgrounding the app — left a recorded miss the user never confirmed, and
the "skip" link under the chips only dismissed the chips, so it read as a
cancel that was not one. The write now happens when a reason is picked or
explicitly declined; "Not missed" backs out with no write because nothing
was committed. Leaving mid-flow leaves the block pending, and the sweep asks
again. A fabricated 'missed' is a real signal to the behavioral engine; an
unanswered block is honestly unanswered.

**A completed block could be sacrificed to make room (fixed 2026-08-26).**
isLiveInstance was a denylist — skipped, removed, rescheduled — so
'completed' counted as a live collider. planDisplacement would offer a block
the user had already finished as the thing to drop, and accepting wrote
'removed' over a real completion. 'missed' had the inverse fault: answered
and not happening, but still reserving its slot, so a morning block could not
be rescheduled into an afternoon gap whose blocks were already resolved.
Now an allowlist: only pending and active occupy time. handleSwap gained the
same guard — it checked is_fixed but not status, so a pending block could be
dragged onto a completed one and rewrite its times.

Follow-up 2026-08-26: handleSwap kept its OWN inline copy of this filter and
was missed by the first fix — it excluded only skipped and removed, so a
block in the Accounted for section still blocked a swap into its old slot.
occupiesTime is now exported and is the single definition. The rule drifted
in three separate places (planDisplacement, findRescheduleSlot, handleSwap)
because each carried its own denylist; any future occupancy check must import
it rather than re-express it.

**Completed blocks kept firing "how'd it go?" (fixed 2026-08-26; delivered
banners 2026-09-03).**
futureInstances filtered on end_minutes and category but never status, and
resyncNotifications had one call site that was not the check-in path — so
answering a block neither cancelled its notification nor rebuilt the set.
Status is now part of notification eligibility, and every status-mutating
handler resyncs, which also re-schedules on undo. A later hole: cancel only
clears the scheduled set, so a banner that had already fired stayed in
Notification Center. Rebuild now dismisses presented managed banners whose
instance is no longer pending/active.

**The evidence pack was time-flat, and the narrator said so out loud (fixed
2026-08-26, 039).** block_stats aggregated 30 days with no recency signal, so
a pattern that stopped four weeks ago was indistinguishable from one
happening today. A real insight told the user post-fajr sleep was costing
Morning Deep Work "this month" when every one of those misses was from July
and August was clean. Separately, the pack had no notion of block AGE — the
tracked CTE admits any block with 3 resolved instances, which a new block
reaches in days, so a block in its first week was told it had "no functioning
slot" and prescribed restructuring. Both are the same defect. block_recency
now carries first_seen, days_tracked, and a 7-day vs prior split, with
caveats forbidding present tense for a pattern absent from the last 7 days
and forbidding diagnosis of a young block.

This is the sharpest form of the trust risk this document already names: an
insight about a habit the user has ALREADY FIXED is worse than no insight,
because it proves the engine is not watching.

**Auto-scroll would have silently broken swap targeting (handled
2026-08-26).** cardPositions holds CONTENT-space coordinates from onLayout;
dragTranslationY is SCREEN-space finger movement. findSwapTarget adds them
directly, which was only correct because the list could not scroll mid-drag.
Enabling auto-scroll makes the two spaces diverge by the distance scrolled,
so the swap would resolve against stale geometry and land on the wrong card —
visible only after scrolling, which is exactly when the user cannot see what
was picked. onEnd now passes translationY plus the scroll delta accumulated
since the drag began. Any future change touching drag or scroll must
preserve this: the two coordinate spaces are not interchangeable.

**Resync silently deleted the pre-block nudge (fixed 2026-08-26).**
scheduleTodayBlockNotifications cancels all managed notifications before
rebuilding from its arguments, so a call omitting an optional argument
deletes that category instead of preserving it. Three of four call sites
passed only (instances, date), so every reschedule, check-in, mark-missed and
undo destroyed the day's block_preempt nudge and stripped nudge_line from
cutoff notifications. The nudge only survived if the user loaded the day and
then touched nothing — which is why it never fired in testing. Both values
are now held in the store and passed by every call site. Any future
notification type must be added to the store-and-pass-through path, not just
to the managed cancel list.

**AuthProvider could hang the app forever with no error (fixed 2026-08-26).**
supabase.auth.getSession() had no .catch() and no timeout, and was the only
path calling setLoading(false). A stalled token refresh or hung storage read
left the app on the loading screen indefinitely with nothing thrown and
nothing logged — indistinguishable from a bundler problem, which is what it
was misdiagnosed as. loadUserData had the same shape: unguarded awaits inside
the chain gating the loading flag. Every await in the auth bootstrap is now
timeout-wrapped and every path terminates in a finally. This is the same
class as the loadToday try/finally issue: any code path that sets a loading
flag must be unable to skip clearing it.

**The cold-start error screen never said "offline" (fixed 2026-08-31).**
RequireAuth passed offline={false} to LoadError unconditionally, because
AuthProvider exposed profileError as a plain boolean with no record of the
failure type. isConnectivityError was already correct and useTodayData
already used it, so only the auth bootstrap — the exact path a user hits
with no network at launch — showed a generic "something went wrong". Found
after a VPN on the test device made every Supabase call unreachable; combined
with the missing auth timeouts that produced an infinite spinner with no
error at all, and roughly two hours were spent looking for a bug in the
repo. AuthProvider now records profileOffline and RequireAuth passes it
through.

**A biweekly block would have been invisible to the engine (pre-empted
2026-08-31, 041).** tracked required 3 resolved instances in 30 days, a
floor set when every block was weekly or more frequent. 040's interval_weeks
makes ~2-instance months possible, so such a block would have been absent
from block_stats, quality_drift, cannibalization and the pre-block nudge with
nothing telling the user. Caught before the recurrence UI shipped rather
than after. The floor now scales to what the block can produce, with two
resolved instances as the hard minimum at any cadence. A matching caveat
tells the narrator that a low days_tracked with an OLD first_seen means
infrequent-by-design, not neglected — two of two scheduled is perfect
adherence.

---

## Retention Architecture v1 — remaining work, in order

Ordering logic, so future sessions understand why: un-backfillable before
valuable; ledger integrity before features; anything the falsifiable test
depends on before anything that only makes the app feel smarter.

> **Tier 1 status:** complete as of 2026-08-13. Tier 2 is unblocked.

### Tier 1 — before external users
Things that corrupt the ledger or lose data permanently.

1. ~~acknowledged_at on status transitions~~ **SHIPPED (024).** Un-backfillable.
   rated_at stamps only on completion; reflected_at only when text is written
   (~31% of misses). Without this, recovery time — deviation to acknowledgment
   — cannot be computed, and it is the metric that tests the falsifiable
   hypothesis.
2. ~~CHECK constraints on status and completion_rating~~ **SHIPPED (025).** The
   status set already drifted once. A bad value written now is corrupt forever.
3. ~~loadToday stale-request guard~~ **SHIPPED.** Monotonic sequence token per
   load; only the newest may write state. currentDateRef alone was insufficient
   because two loads for the SAME date both passed it.
4. ~~Tests on stats.ts and recoveryCopy.ts.~~ **SHIPPED.** vitest, pure modules
   only — no React, no React Native, no Supabase mocking. computeStreakData was
   extracted from fetchTodayStats so the accounting math is testable without I/O.
   Deliberately NOT taking on component or integration testing.

### Tier 2 — instrument now, build later
5. ~~Intervention→outcome and miss_reason_tag into the evidence pack.~~ **SHIPPED (026).**
   **Cutoff nudges + telemetry** (016 nudge_events) already carries instance_id,
   response, and scheduled_for; joined to the instance's final status that IS
   intervention → response → outcome. The moat data is already accumulating
   and read by nothing. **Preset miss reasons** (019 miss_reason_tag) is in
   the same state. ~25 lines of SQL, no new schema, no AI cost.
6. ~~Cross-block cannibalization detection.~~ **SHIPPED (026).** The evidence pack computes every
   block in isolation — block_stats is per-block and day_shape is an
   unstructured string of names. Nothing computes whether block B's failure is
   CONDITIONAL on block A's, so the narrator cannot state the pattern even
   though it is present in the data.

   Real example from single-user data: reflections state it five times ("I let
   my deep work spill into this", "I extended my deep work too much and ate into
   this", "Heavy deep work day"), and swap_drift corroborates independently —
   Cardio moved 29 times, Weights 11, Morning Deep Work 3. Everything
   reorganizes around the block that never moves. Two independent sources agree
   and the engine still cannot say it.

   Implementation: for block pairs with sufficient shared days, compute B's
   failure rate on days A failed versus B's baseline failure rate. Surface pairs
   where the conditional rate materially exceeds baseline. ~30 lines of SQL, no
   new schema, no AI cost.

   This is the highest-value unread signal remaining, and it corresponds
   directly to the cannibalization pattern in the Who FlexMax is for section.

   > **Signal-integrity note (027).** swap_drift originally counted edit ROWS,
   > so swaps, swap-backs and multi-step repositioning all inflated it. 027
   > counts net displacement per instance instead. The corroboration this item
   > cites was restated as a result — see "Evidence restated 2026-08-24 (027)"
   > under Known issues.
7. **Intention-reliability metric.** Planned vs. completed minutes over time —
   are the user's plans becoming more accurate. Pure SQL.
8. **DeviceActivity drift-event table.** Schema only, no extension, so the shape
   exists when the entitlement lands.

### Tier 3 — do not build yet
- **Offline write queue.** Designed and deferred 2026-08-20. Full spec,
  failure history, and build order in `docs/offline-mode.md`. Scope line:
  recording works offline, planning requires a connection.
- **DeviceActivity extension**, autonomous intervention, voice input, email,
  third-party integrations, richer AI.

---

## Vision — designed, not built

*Everything in this section is unbuilt. Nothing here is scheduled, and nothing
downstream should assume it exists. It is recorded because the data it consumes
is now shipped — migration 026 closed the last input gap — and because the
constraints attached to these features are easier to write down before the
features exist than after.*

### The frame: Software as a Mentor

The product's genesis. A mentor who sees everything and judges nothing. The
structural asymmetry that makes this possible in software and impossible in a
human relationship: **a human mentor can only work with what you let them see.**
Effort spent managing a face is effort not spent executing, and the information
withheld is exactly the information that would have helped. Software has no face
to perform for, so it gets told the truth. That is the whole thesis, and every
feature below either serves it or should be cut.

### The Prediction Engine

Each morning the app makes **one to three falsifiable predictions** about the
day and shows them to the user before the day happens.

> Today I think: you'll complete deep work. You'll miss the 6pm gym. You'll
> finish at 11:40, not 10:30.

At day's end it scores itself against reality and displays running accuracy —
"right 34 of 51 times." Inputs already exist: `block_stats` (per-block
completion by slot), `day_shape` (weekday patterns), `weekly_trend`, and
`nudge_outcomes` (026), which is what lets predictions about *intervention
effectiveness* work at all.

Why this is the highest-value unbuilt feature:

- **It makes "it knows me" repeatable.** Feeling understood is a one-time high
  that decays in about two weeks. A prediction re-earns it daily and cannot be
  faked.
- **It inverts shame into challenge.** "You missed the gym 4 times" produces the
  freeze. "I think you'll skip the gym tonight" produces *watch me*. Identical
  information, opposite emotional charge. When the user beats a negative
  prediction, the app says so plainly — "Impressive. You proved me wrong."
- **It is the answer to the falsifiable test.** A journal describes. A
  prediction dares. This is the mechanism by which the product could plausibly
  change behavior rather than merely narrate it.
- **It renders the moat visible.** Accuracy climbing from 55% to 80% over months
  *is* the compounding behavioral model, displayed as a number the user watches
  improve.

**NON-NEGOTIABLE CONSTRAINT — predictions are generated from the evidence pack
only, and are NEVER tuned on user response.** Accuracy is scored against
reality, not engagement. If a future session observes that pessimistic
predictions correlate with completion, that is not a discovery and must not be
acted on — deliberately predicting failure to provoke a reaction destroys the
one property that makes the feature valuable, which is that the app publishes
its own error rate honestly. A sandbagging prediction engine is a slot machine
in a lab coat, and this ICP will detect it.

**Language rule:** the mechanism is a *challenge*, never a *manipulation*.
Manipulation requires concealment; the prediction is shown to the user before it
resolves, and they choose to beat it. Internal shorthand that frames this as
manipulating the user must not appear in the repo, in copy, or in prompts.

### The Theory of You

A living document the app maintains *about* the user, in plain sentences,
readable at any time.

> You execute best 7–11am. Afternoons degrade sharply after 2. When work slips,
> fitness is sacrificed first — 6 of your last 8 bad weeks. Rest you plan goes
> fine; rest you don't plan turns into three days.

**The user can argue with it.** Tap any line: "that's not right." The app asks
why and updates. A mentor you can correct is a relationship; a dashboard you
cannot correct is a verdict. This is also the answer to what the product is for
after a schedule stabilizes — the Theory is portable to every new goal, and does
not expire when the current problem is solved.

### The Evidence Archive

A running, in-app record of what the user actually did — hours executed,
blocks completed, accounted-for streaks, the arc of a chapter. Not
analytics: **proof**.

This exists because of the long-arc failure in `Who FlexMax is for`: drift
leaves a person with nothing to point at, and a person with nothing to point at
loses the argument for their own ambition — first to someone else, then to
themselves. The Archive is the counter-evidence. It is not for the app. It is
for the day someone asks what they've been doing.

**Export is deliberately excluded.** A portable behavioral history is
switching cost handed back — the accumulated per-user understanding is the
moat, and a file the user can carry elsewhere is the one form of it a
competitor could ingest. The Archive is for looking at, in the app, on the
day someone asks what you've been doing.

Not to be confused with account deletion (shipped, an App Store
requirement) or with any statutory data-portability obligation, which is a
separate legal question and unresolved. This decision is about export as a
*product feature*, not about compliance.

### Chapters

Twelve-week arcs that end in a real review. Life has arcs; a schedule should not
be an undifferentiated stream.

**Chapters are the ONLY place charts and visualizations belong.** The daily and
weekly surfaces stay textual and small-number honest ("4 of your last 5", never
a dressed-up percentage). A chapter boundary is an explicit look-backward
moment where the user is deciding what changes next, and visuals earn their
place there. Charts on Today, or a daily dashboard, is the journal trap: a
product people enjoy reading and do not act on.

### Supporting features

- **Declared rest.** Rest days chosen in advance, honored by the mentor,
  excluded from stats. Directly addresses design constraint 1 — rest must be
  legitimate and chooseable, never something to hide. The onboarding question
  about rebellion currently has no downstream effect; this closes that loop.
- **The intervention ledger.** What actually works *on this person*: which nudge
  timings land, which don't, when moving the block beats nudging at all.
  `nudge_outcomes` (026) is the foundation. This — not behavioral history alone
  — is the moat.
- **Graduation.** Blocks that have gone automatic are retired from active
  tracking. The mentor's job is to become unnecessary in specific places.
- **Voice reflections.** Typed input remains the default and the primary path;
  voice is an alternative that transcribes into the same
  `reflection_why` / `reflection_improve` fields. Long, messy, unstructured
  reflections are *higher* signal than terse ones — do not truncate, summarize
  away, or discourage them at capture time.

### What is deliberately NOT in this vision

Beautiful daily graphs. A peer-reviewed study-technique library (generic advice
is copyable, free elsewhere, doesn't compound, and breaks the claim that the app
speaks only from the user's own ground truth). Social features. Integrations. AI
that authors the schedule.

If the product were only the morning prediction, the mid-day interrupt, and the
return-after-collapse account, it would still be the strongest thing in the
category. Everything else is amplitude.

---

## Who FlexMax is for

*Derived from founder-as-primary-user research. n=1 — the beta's job is to
test whether this archetype generalizes.*

### The person

Genuinely ambitious, with goals that are their own. Capable of sustained
effort — has built things, finished things, and knows what their good weeks
look like. Not someone who needs convincing that change is worth wanting.

The gap is not motivation and not planning. They can produce an accurate,
realistic schedule and then fail to execute it, repeatedly, without ever
making a conscious decision to abandon it.

**The failure mechanism: unconscious inaction.** Time is not consciously
traded away — it evaporates. There is no moment of choosing distraction over
the plan; there is only a later moment of noticing the plan didn't happen.
This is the specific thing FlexMax exists to interrupt.

### The collapse pattern — two timescales

**Short arc (days):**

1. Structure holds while something external is watching.
2. External structure is removed — travel, a break in routine, a quiet week —
   and execution collapses quickly and completely, not gradually.
3. The gap between plan and reality grows large enough that reviewing it
   becomes aversive.
4. **The freeze.** Re-engaging now requires confronting the whole accumulated
   shortfall at once, so it gets avoided entirely. This is the uninstall
   moment for every tool they've tried.

The freeze is the highest-leverage moment in the product. Everything about the
recovery flow, the accounted-for streak, and the collapsed multi-miss path
exists to make re-entry cost less than avoidance.

**Long arc (months) — the higher-stakes version:**

1. Sustained unconscious drift on a goal the person genuinely owns.
2. Effort is real but unregistered; **no visible results accumulate.**
3. When the goal is challenged — by someone else, or by their own review of
   it — there is no evidence to point at.
4. The goal becomes indefensible. Belief in it collapses, and the person
   yields to someone else's plan for them.

**The causality runs in this direction and it is easy to get backwards.** The
drift is not a symptom of lost motivation. The drift is what *produces* the
absence of evidence, and the absence of evidence is what dissolves the
motivation. A person can want something entirely for their own reasons and
still lose it this way.

This is the real stake of the product. Not hours recovered — the capacity to
defend one's own ambition, which requires having something to point at.

### The cannibalization pattern

Drift does not spend time evenly across a schedule. It triggers **active
sacrifice of specific blocks to subsidize others.** When a status-goal slips,
the compensation is not "everything loses a little" — it's a targeted raid on
whichever blocks feel most sacrificeable in the moment, characteristically
health, fitness, and anything framed as maintenance rather than progress.

This is self-defeating in a specific, mechanical way: the sacrificed blocks
are not peers to the protected one, they're **infrastructure it depends on.**
Degrading them degrades the capacity the protected goal actually runs on. The
compensation strategy undermines the exact thing it's trying to save.

**Design implication:** the product needs to treat blocks as having
*interdependence*, not just individual completion rates. A block that gets
disproportionately sacrificed whenever a different specific block is missed is
a detectable pattern — and naming it directly ("your workouts disappear in the
same week your deep work slips — cutting one doesn't protect the other") is a
materially different, more useful insight than reporting on either block in
isolation.

### Why previous tools failed them

- **Calendars and planners:** the schedule was accurate. It was ignored.
  **A calendar entry is a suggestion with no weight behind it** — it fires a
  notification on a fixed timetable, carries no knowledge of the person, and
  decays into background noise within weeks. Being reminded is not the same as
  being known. The design problem this sets: give the schedule *weight*
  without giving it *pressure*, since this audience fails in both directions.
- **Habit trackers:** rendered the shortfall as a verdict, which accelerated
  the freeze rather than relieving it.
- **Nothing they tried distinguished a deliberate rest from a silent
  collapse.** Both showed up as the same empty row.

### The core insight: honesty is easier without a face

This user has had real human accountability and found that it works — and that
it comes with a tax. In front of a person, effort gets diverted into managing
perception: presenting the week favorably, emphasizing what went well,
deflecting from what didn't. The diversion is not dishonesty so much as
self-protection, and it has two costs:

1. Energy that would go into execution goes into presentation instead.
2. **The accountability partner can only work with what they're shown** — so
   the most useful information, the actual pattern of failure, is precisely
   the information withheld.

An AI removes the audience. There is no one to disappoint, no status to
protect, no embarrassment in reporting a nap or a lost afternoon. This produces
a strictly better input than human accountability can obtain, which is why the
resulting understanding can exceed what a human mentor would reach.

**This is the product's central claim and its most defensible one.** Not "AI is
smarter than a mentor" — "an AI gets told the truth, and a mentor doesn't."

### Not everything from the mentor gets discarded

The surveillance and the judgment should go. **Routine itself should not.**
These turned out to be separable, and the separation matters for design.

Structure, held for its own sake rather than because someone is checking, is
what prevents the cannibalization pattern above. A block with real weight
behind it doesn't get silently raided when a different part of the day goes
sideways — an unprotected intention does. This isn't an accountability effect.
It doesn't require anyone watching. It's what a schedule does when it's
actually load-bearing instead of a suggestion.

The product's job is to reproduce *this* half of the mentor relationship —
routine with real weight — without reproducing the half that made honesty
costly. Getting only the second half (accountability, minus structure) would be
an incomplete rebuild; the routine was doing real work on its own.

### What they actually want

- To be seen accurately: capable *and* currently falling short, without either
  fact cancelling the other.
- Accountability without ambient dread. Rest must be legitimate and
  chooseable, not something to hide.
- **Consciousness restored at the moment it drops**, which is the only
  intervention that addresses the real mechanism.
- Peace rather than pressure. Deadline pressure produces compliance; it does
  not produce durable execution, and it degrades the quality of self-reporting.
- Proof that acting deliberately becomes *easier* than drifting — not that they
  should try harder.
- **Accumulated evidence of their own effort.** A record they can point at, for
  their own belief before anyone else's. The person who can see what they
  actually did is much harder to talk out of their own goals.

### Who this is NOT for

- **No internal motivation of their own.** Someone who acts only under external
  compulsion needs a different product; FlexMax assumes the wanting is already
  there and only the execution is broken. This is a statement about *whether
  the product is useful*, not about whether drift occurs — drift happens
  independently of where the motivation came from, and it happens to people
  whose goals are entirely their own.
- **Already has a working system.** If their current approach produces
  acceptable results, there is no gap to close and nothing here to sell.
- **Wants to be told what to do.** FlexMax observes and reflects; it does not
  author goals.

### Design constraints that follow

1. **Never create surveillance anxiety.** If the app makes rest feel risky, it
   has reproduced the exact failure of human accountability it exists to
   improve on.
2. **Nudges must be earned and specific**, or they become the same wallpaper
   every calendar notification became. A nudge that can cite a reason is a
   different object than a nudge that fires on a timer.
3. **Deliberate rest and silent collapse must be distinguishable** in the data
   and in the interface.
4. **Re-entry after collapse must cost less than avoidance.** Multi-miss days
   collapse to one path, one acknowledgement, one way forward.
5. **Never reflect the user's harshest self-description back at them.** This
   audience arrives already fluent in self-criticism; the product's value is
   accuracy, which is a different thing and usually a kinder one.
6. **Detect and name cannibalization — do not structurally prevent it.**
   Health, sleep, and anything framed as maintenance rather than progress tends
   to get sacrificed first when a status-goal slips. The response is to surface
   the cross-block pattern explicitly ("your workouts disappear the same weeks
   your deep work slips — cutting one doesn't protect the other"), not to lock
   the block. Anchoring infrastructure blocks trades cannibalization for
   rigidity, and rigidity produces the freeze. Naming respects the user's
   agency; locking does not.

### Internal archetype (not for external use)

"The Capable Drifter" remains useful for product thinking and shapes tone
decisions. The external market definition is behavioral: **high intention ×
low execution reliability**, with unconscious inaction as the named mechanism.
Personality framing narrows the market and asks people to self-identify with a
label nobody wants; the behavioral framing describes a problem people
recognize immediately in themselves.

---

## Product context (for AI-assisted decisions)

**Ideal customer:** see **Who FlexMax is for** above. External definition:
high intention × low execution reliability. External pain sentence: "I know
what I need to do — why can't I consistently make myself do it?"

**Competitors:** none tracked. See **Category and boundaries** for the
constraints that used to be derived from competitive analysis.

**Habit-tracker competitor:** Me+ Lifestyle Routine (Enerjoy) — 21M downloads, 4.79 stars.
Validates market. Static tracker, MBTI "personalization," self-care framing.
Positioning: "Me+ helps you decorate a routine. FlexMax helps you keep one."
Compete ONLY on adaptive intelligence + flexibility axis. Never on templates or aesthetics.

**Pricing:** See **Pricing & paywall** below.

**The moat:** intervention → response → outcome — six months of what actually
works on this specific person. History is copyable given time; a record of which
interventions moved this individual is not. Switching cost grows every week of
use. Models commoditize; intervention efficacy on *this* user does not.

**The retention risk:** shame-churn. Users who fail may avoid reopening the app.
Recovery-without-judgment is the design bet. Instrument this in the beta.

---



## Honest risks (carry these — do not let them drift)

**The falsifiable test.** FlexMax must make execution measurably better, not
merely make the user feel understood. Stated plainly so it can be failed:

> If users love the insights but don't execute better, FlexMax is a
> sophisticated productivity journal.

Everything in the roadmap is subordinate to this. A feature that improves how
smart the app feels without improving whether the user follows through is not
progress.

> **The ICP is n=1.** The archetype is derived from the founder as primary
> user — see Who FlexMax is for above for the full picture. It is coherent and
> internally consistent, and it is still one person. The beta's job is to test
> whether it generalizes; treat every element of it as a hypothesis until real
> testers either confirm or break it.

**The truth-telling claim is untestable on its current sample.** The argument
that users tell an AI the truth is validated on one person who is also the
product's author — someone with no incentive to manage the app's perception of
him. That is the exact population where the claim cannot be tested. Whether a
paying stranger reports a lost afternoon honestly to software is unknown, and
the beta is the first opportunity to find out.

- **Everything is validated on n=1.** Every filter, threshold, and tone rule was
tuned against the author's own month of data — an unusually diligent
self-journaler who wrote 31 reflections in 30 days. Whether any of it survives
sparse, low-effort user data is untested and is the whole ballgame.
- **Interaction-derived signals on n=1 are contaminated, not merely thin.**
The reflections are honest data — 31 in 30 days, no audience to perform for.
But every signal derived from how the sole user TOUCHES the app is produced
by someone testing that app: swap_drift, rated_at/reflected_at check-in
timing (010), acknowledged_at recovery time (024), and nudge response rates
(018/026). The 2026-08-24 swap audit found 69% of all logged time changes
landing within 30 seconds of the previous edit to the same instance, across
14-18 distinct days per block — daily interface exercise, indistinguishable
in the data from scheduling intent. This is not a thin-sample problem that
more of the founder's data would fix. It is a wrong-direction problem that
only a tester who is not building the app can resolve, and it applies most
sharply to acknowledged_at, which Tier 1 justified as the metric that tests
the falsifiable hypothesis.
- **Reflection dependency is the bottleneck.** The engine is text-first because
the user's own words are the highest-signal data. Most users write nothing.
reflection_improve is at 31% fill for the ONE user who exists.
- **The moat is retention-dependent.** Accumulated behavioral history only
compounds if the user keeps opening the app. Shame-churn is the named risk.
- **Differentiation is more copyable than this document implies.** A funded
incumbent could ship a weekly "why your plans fail" card as a feature update.
The durable edges are tone discipline, data-integrity care, and eventually the
behavioral corpus itself.
- **NORTH-STAR METRIC: on days the plan breaks, does the user complete the
next meaningful action and return tomorrow?** Stream 1's metric, and it must
hold in week one, before the insight engine has said anything. Reopening
alone is a supporting signal — it measures whether the user came back, not
whether the product changed what they did, and returning without executing
is a journal outcome. Capture for the supporting reopen query shipped in 028
(`app_sessions` / `record_app_open`). The defining query sits under the
migrations table.

**The shipped thresholds are invented too.** Deferring Bayesian machinery on the
grounds that the calibration is n=1 was correct — but the same logic applies to
the thresholds that *did* ship. Three check-ins, 25% of instances, 80%
accounting, the ≥4-miss pattern floor: all chosen from one month of one person's
data. They are cheaper guesses, not settled constants. Treat every one as an
instrumented parameter to be re-fit from the first TestFlight cohort, and expect
at least one of them to be wrong.

**The founder's own fill rate proves the least.** Months of daily use
demonstrate the accounting ritual is livable, which is worth knowing. It cannot
indicate what a stranger does at 11pm on day nine. The person who designed the
schema knows exactly what each field feeds and is motivated to feed it well.
Every engagement number sourced from founder use is a lower bound on
tolerability and tells you nothing about adoption.

**Surface coverage is thin and that is a real cost.** No widgets, no Apple
Watch, no calendar integration, no Android. These are not the differentiator and
should never be the pitch, but they are table stakes for a paid app in this
space and their absence will show up in reviews and in churn. Widgets are
targeted for v2.



## Beta success criteria

Six proof points, in order. Everything else is downstream of these, and none
can be answered without real testers.

1. **Do users fill `reflection_why` unprompted by day ten?** The cheapest
   decisive number in the entire plan, and the one that determines whether the
   loop is self-sustaining. Above ~50% the product works on its own; below ~25%
   it is being carried by notifications and the retention model collapses.
   Current baseline is 31% on n=1. Measure this before spending anything on
   acquisition — every other number downstream assumes this one reads clean.
   *Threshold caveat: the >50% / <25% figures were set against a two-field ask.
   With a single field the same numbers describe an easier action, so treat them
   as provisional until the first cohort re-fits them. The 31% baseline is
   likewise from the two-field era and is not directly comparable.*
2. **On days the plan breaks, does the user complete the next meaningful action
   and return tomorrow?** The north star. Stream 1's metric, and the one that
   must hold in week one — it tests execution salvage, which works on day one
   and does not depend on the insight engine having anything to say yet.
   Reopening alone is a supporting signal; completing the next action is the
   falsifiable one.
3. **Can strangers understand the difference in 10 seconds?** Not "is it good" —
   can someone who has never heard of it tell FlexMax apart from a planner from
   the App Store listing and the showcase page alone.
4. **Will they pay before using it?** The hard paywall is deliberate and filters
   for the decided cohort, but the conversion floor is unknown.
5. **Will they reopen after a bad week?** A supporting signal, not the north
   star. Capture is 028; the query sits under the migrations table. Reopening
   measures whether the user came back, not whether the product changed what
   they did.
6. **Does the behavioral insight feel surprisingly accurate?** Stream 2's proof
   point — half the differentiation, not the whole. Validated on n=1 so far.

If 1-6 hold, $14.99 is not the limiting factor. If they do not, more features
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

That last screen reframes the $14.99 honestly — the user is buying a working
execution-salvaging tool immediately, with the insight layer arriving on top of
it after about a week. That is the true version of
the aha the AI conversation used to fake.

**docs/index.html — rebuilt 2026-08-11 as an engine overview.** The previous
version was a hand-built replica of the app's UI and had drifted twice
(deleted AI onboarding flow, retired amber streak strip, old palette). The
replacement describes the engine — architecture, integrity rules, real
generated output, honest build status — and contains no UI replica, so it has
no drift surface. A print-formatted PDF of the same content is published
alongside it at docs/flexmax-behavioral-engine.pdf for handouts.

Still open: with no free trial this page is the only pre-purchase evaluation
surface and it does not yet carry pricing or founding-member framing. When the
in-app interactive demo ships, its screen recordings belong on this page.

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
