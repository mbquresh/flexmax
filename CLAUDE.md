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
| Dark theme                                    | lightColors / darkColors, ThemeProvider, System/Light/Dark toggle |
| Brand mark and loader                         | BrandMark SVG, BrandLoader on six full-screen loads |
| Press feedback system                         | PressableScale scale + highlight variants |
| reflection_improve chips                      | Five presets + "Something else" escape hatch in RecoverySheet |
| Reschedule sleep boundary                     | findRescheduleSlot respects sleep_target_minutes; manual adjust in RecoverySheet |




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
| Device activity detection (Screen Time) | Policy-verified design: user self-selects distraction apps via FamilyActivityPicker → OPAQUE TOKENS, so FlexMax structurally cannot know which apps were chosen. Each focus block registers a DeviceActivitySchedule with a threshold event (e.g. 5 cumulative minutes); eventDidReachThreshold fires a local notification reusing the existing **Notification action buttons** (018 nudge_response) infrastructure. The extension records to an App Group store; the app syncs a minimal derived record only — drift occurred, duration bucket, response, block outcome. Never raw usage. NOTE: DeviceActivityReport data is render-only and not readable programmatically, so the threshold event IS the data model — and it happens to be exactly the intervention→response→outcome shape. CONSTRAINTS: entitlement is per bundle ID, main app AND every extension; unrequested extension IDs fail signing at distribution. Requires native Swift extensions — config plugin (react-native-device-activity) or prebuild. Approval takes days to weeks. See UNBLOCKED ACTION above. |
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
`c.danger`. Coral is reserved for Remove and Missed. Undoing a completion is a
correction.

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
Today screen on a spinner permanently with an unhandled rejection. Also give
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

---

## Retention Architecture v1 — remaining work, in order

Ordering logic, so future sessions understand why: un-backfillable before
valuable; ledger integrity before features; anything the falsifiable test
depends on before anything that only makes the app feel smarter.

### Tier 1 — before external users
Things that corrupt the ledger or lose data permanently.

1. **acknowledged_at on status transitions** (024). Un-backfillable. rated_at
   stamps only on completion; reflected_at only when text is written (~31% of
   misses). Without this, recovery time — deviation to acknowledgment — cannot
   be computed, and it is the metric that tests the falsifiable hypothesis.
2. **CHECK constraints on status and completion_rating** (025). The status set
   already drifted once. A bad value written now is corrupt forever.
3. **loadToday stale-request guard.** A slower earlier request landing after a
   newer one shows wrong state the user then acts on.
4. **Tests on stats.ts and recoveryCopy.ts.** Pure functions, repeatedly
   rewritten, computing the numbers the user sees. See the offline queue
   postmortem (Known issues) for what shipping unverified logic costs.

### Tier 2 — instrument now, build later
5. **Intervention→outcome and miss_reason_tag into the evidence pack.**
   **Cutoff nudges + telemetry** (016 nudge_events) already carries instance_id,
   response, and scheduled_for; joined to the instance's final status that IS
   intervention → response → outcome. The moat data is already accumulating
   and read by nothing. **Preset miss reasons** (019 miss_reason_tag) is in
   the same state. ~25 lines of SQL, no new schema, no AI cost.
6. **Intention-reliability metric.** Planned vs. completed minutes over time —
   are the user's plans becoming more accurate. Pure SQL.
7. **DeviceActivity drift-event table.** Schema only, no extension, so the shape
   exists when the entitlement lands.

### Tier 3 — do not build yet
- **Offline write queue.** Built and reverted 2026-08-09; see Known issues.
  Revisit only if real testers report lost writes.
- **DeviceActivity extension**, autonomous intervention, voice input, email,
  third-party integrations, richer AI.

---



## Product context (for AI-assisted decisions)

**Ideal customer:** "The Capable Drifter" — 20-32, ambitious, serial abandonér of
Notion/Habitica/planners, ADHD-adjacent segment deliberately valuable, converts
Sunday evening, pays $10/mo, allergic to toxic-positivity AND shame, Apple-polish taste.

**External ICP definition: high intention × low execution reliability.**
"Capable Drifter" remains the internal archetype and shapes tone decisions. The
market-facing definition is behavioral, not psychological, because the pain is
self-recognizable without a diagnosis. The external pain sentence:

> "I know what I need to do — why can't I consistently make myself do it?"

**Core promise: closing the gap between intention and execution.** Never "AI
productivity" — that category is crowded and it is not what this does.

**Day-planning competitor:** Structured — see **Competitive positioning** above.

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
