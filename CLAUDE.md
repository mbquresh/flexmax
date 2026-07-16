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

## v1 AI data map (what the AI sees today vs what's captured but unused)

**AI reads:** onboarding transcript (once), static psychology profile (tips once,
recovery per-miss with miss count). Profile FROZEN after onboarding.

**Captured but never read by AI (v2 fuel):**
- completion_ratings on every check-in
- reflection_why + reflection_improve on every miss
- removed_reason on every removal
- adhoc_tasks completion behavior
- day-of-week patterns in daily_schedule_instances

**Capture gaps to fix in v2 (behavioral learning needs these):**
- Swap audit trail (currently old times are overwritten, no history)
- Notification response tracking (did the user act on the nudge?)
- Check-in timing (how long after block end did they rate it?)

Prerequisites for v2b differentiation vs Structured — see **Competitive positioning**.
Data not captured today is unrecoverable later.

---

## v2 roadmap (sequenced)

| Phase | What | Notes |
|-------|------|-------|
| v2 prep NOW | Apply for FamilyControls entitlement | Time-gated by Apple; apply at developer.apple.com |
| v2 prep | v2-issues.md hardening (rate limiting first) | Must precede public exposure |
| v2a | EAS build → TestFlight (10-20 users) | Gate for real notifications + native extension |
| v2a | Presence-aware nudges (block-start + mid-block) | Requires EAS; feeds behavioral learning |
| v2a | Capture gap fixes (swap trail, notif response, timing) | Prerequisites for v2b vs Structured — see **Competitive positioning** |
| v2b | Behavioral learning v1 — THE flagship | Profile evolves from actual behavior |
| v2b | Shareable weekly recap card | Organic growth primitive |
| v2b | Morning brief | Powered by evolved profile |
| v2c | Screen Time API app shielding | Requires entitlement + EAS + native extension |
| v2c | Dark theme | Design tokens make it feasible |

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
