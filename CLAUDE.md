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

| # | File | What it does |
|---|------|-------------|
| 001 | initial_schema.sql | All core tables, RLS, generate_daily_instances fn |
| 002 | profile_on_signup.sql | Auto-create profile on auth.users insert |
| 003 | schedule_tips.sql | schedule_tips column on psychology_profiles |
| 004 | block_flexibility.sql | is_fixed on schedule_blocks + daily_schedule_instances |
| 005 | block_removal.sql | removed_reason column on daily_schedule_instances |
| 006 | adhoc_tasks.sql | adhoc_tasks table + RLS |
| 007 | secure_generate_instances.sql | Security split: generate_my_daily_instances (client-safe, auth.uid() scoped) + revoke execute on global from authenticated |
| 008 | swap_instances_rpc.sql | swap_instance_times transactional RPC (atomic, ownership-validated) |
| 009 | swap_audit_trail.sql | instance_time_changes audit trail + trigger (swap RPC untouched) |
| 010 | checkin_timing.sql | rated_at / reflected_at on daily_schedule_instances + trigger |
| 011 | local_time_notify.sql | users_to_notify_now RPC for per-user local-hour notifications |
| 012 | sweep_unaccounted.sql | sweep_unaccounted_instances RPC + hourly cron; unaccounted status |
| 013 | behavior_evidence.sql | get_behavior_evidence() RPC — precomputed 30-day facts |
| 014 | actual_end_minutes.sql | actual_end_minutes column for real bedtime capture |
| 015 | behavioral_insights.sql | behavioral_insights table; weekly stored beliefs, RLS read-only for users |

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
missed-block-recovery, nightly-notify.

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
| What | Where |
|------|-------|
| Rate limiting on all AI edge functions | _shared/rateLimit.ts; check placed AFTER cache checks |
| EAS build → TestFlight (internal only) | eas.json; F-mark icon set |
| Hamburger menu + action sheet | AppMenu.tsx; tricolor button |
| Plan Tomorrow screen + notification deep-link | app/plan-tomorrow.tsx |
| Per-user local-time notifications | users_to_notify_now RPC (011); hourly cron; DST-proof |
| Device timezone sync | profiles.timezone, written on session establish |
| Swap audit trail | 009, trigger-based — swap RPC untouched |
| Check-in timing | 010, rated_at / reflected_at |
| Unaccounted sweep | 012, hourly, timezone-aware, 4am local grace |
| Behavioral evidence pack | 013 |
| Retroactive bedtime capture | 014 + BedtimeCard.tsx |
| Behavioral learning v1 (THE flagship) | 015 + weekly-insight + InsightCard |
| Deterministic recovery copy (AI call REMOVED) | src/lib/recoveryCopy.ts |

### Not built
| What | Notes |
|------|-------|
| Presence-aware nudges (block-start + mid-block) | The "smart notification suite". User requested this in their OWN reflections 3x: "harder cutoffs", "need enforcements", "maybe you can do something to help" |
| Shareable weekly recap card | The weekly scorecard. Growth primitive |
| Notification response tracking | Pairs with nudges — build together |
| Day-3 first observation | New users currently see NOTHING for 5+ days (weekly-insight gates at engaged_days < 5). Week one is when they decide to keep the app |
| "Ask me about yourself" conversational surface | Reads get_behavior_evidence with the narrator's tone rules |
| reflection_improve UX fix | 31% fill rate on the highest-signal field in the DB |
| External TestFlight | Needs Beta App Review (~1 day) + a demo account or auto-rejection |
| Screen Time shielding | FamilyControls entitlement — STILL UNFILED. Multi-week Apple clock |
| Dark theme | Design tokens make it feasible |

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

**Pricing:** 14-day trial → $9.99/mo. Grandfather early users. Annual encouraged.

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

## Unresolved decisions

- **Paywall model.** CLAUDE.md currently says 14-day trial → $9.99/mo. A later
  strategy session proposed a HARD paywall immediately after AI onboarding with
  NO free trial. Unresolved — the hard paywall contradicts a value proposition
  built on compounding behavioral understanding, since it charges before the
  mechanism that justifies the price has done anything. Do not treat either as
  settled.
