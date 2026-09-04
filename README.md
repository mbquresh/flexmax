<p align="center">
  <img src="apps/mobile/assets/icon.png" width="88" alt="FlexMax">
</p>

<h1 align="center">FlexMax</h1>

<p align="center"><strong>There was never a moment you decided to skip it.</strong></p>

<p align="center">
  <a href="https://mbquresh.github.io/flexmax"><strong>Try the schedule →</strong></a><br>
  <sub>The real drag-to-swap engine, running in the browser. No signup.</sub>
</p>

---

FlexMax is a behavioral accountability app for iOS. You build your day out of
time blocks. When the day breaks — and it will — the schedule rebuilds around
what is still possible instead of turning red. Over weeks, it works out why your
plans keep breaking and tells you, with the counts attached.

It is not a calendar. A calendar entry is a suggestion with nothing behind it:
it fires on a timer, knows nothing about you, and fades into background noise
within a fortnight. FlexMax is built for the moment after that — the missed
block, the collapsed afternoon, the week you would rather not open.

## Why it exists

Every planner works well when you are already doing well. The people who need
one most abandon app after app, not for missing features, but because day three
of a bad week made the tool feel like a verdict.

Rescheduling a missed task moves a block. It does not ask why the block keeps
getting missed. Miss the gym forty times and a planner will cheerfully schedule
gym forty-one, identical to the first.

FlexMax counts. It reads across days rather than within one, so it can find the
cause that sits eight hours earlier and four blocks upstream — the thing you
would have to remember a Tuesday morning to explain a Thursday evening.

## Two halves

**Execution salvage — works the hour you install it.** Drag-to-swap with
durations and gaps preserved, a reschedule resolver that names what a move would
cost rather than refusing, shrink-to-fit when nothing full-length is left, fixed
anchors, an accounted-for streak where marking something missed keeps the streak
alive and only silence breaks it. No history required, nothing to type.

**Behavioral insight — arrives around week two.** SQL computes every number,
Claude narrates once a week, and the resulting beliefs are injected free into the
morning card, the recovery sheet and the weekly recap.

The [interactive demo](https://mbquresh.github.io/flexmax) runs the first half in
the browser: the same anchor arithmetic, the same collision refusals by name, the
same shrink planner.

## Core loop

1. Seven-beat onboarding — two recognition questions, three preferences, a
   playback, and a contract screen. No AI, no typing.
2. Build a schedule of time blocks, flexible or fixed, with recurrence
3. Timezone-aware notifications through the day
4. Check-ins: crushed it / partly / lost focus — the middle option carries the
   signal
5. Missed blocks open recovery: acknowledge, reflect, reschedule
6. Once a week, the engine explains a pattern in your own days

## Status

**v2 — on TestFlight, internal testing.** Built solo.

The behavioral engine is live end to end: `get_behavior_evidence` in SQL, one
weekly Claude call, stored beliefs injected into the morning card, recovery sheet
and weekly recap. Swap patterns, completion quality, miss reasons and nudge
outcomes all feed it.

Also working: schedule builder with drag-to-swap, auto-scroll, fixed anchors,
archiving and recurrence; per-day wake and sleep boundaries; a reschedule
resolver that names what a move would cost; resolved blocks moving to an
Accounted for section; a quality degradation prompt when a block starts landing
at half strength; a pre-block nudge on blocks that have been failing;
timezone-aware notifications; account deletion; rate-limited AI endpoints with
the key server-side only.

Not built yet: payments, calendar export, Screen Time shielding (awaiting an
Apple entitlement), widgets, Watch.

Roughly three quarters built. The remaining quarter is distribution, not
intelligence.

## How the engine works

**SQL computes. Claude narrates. Nothing learns in the dark.**

All arithmetic — counts, rates, trends, correlations — happens in Postgres, where
it is exact and auditable. The model receives finished numbers and the user's own
verbatim words. Its single job is to name the causal story and cite the evidence.
It never calculates, never invents a statistic, never decides strategy. One AI
call per user per week.

The full write-up — architecture, the six data-integrity rules that were each
learned by building the wrong thing first, tone constraints, and what is
deliberately deferred — is in
**[docs/behavioral-engine.md](docs/behavioral-engine.md)**.

## Stack

| | |
|---|---|
| Mobile | Expo (React Native), Expo Router, Zustand, Reanimated |
| Backend | Supabase — Postgres + RLS, auth, edge functions, cron |
| AI | Claude API, called only from edge functions |
| Notifications | Expo Notifications, resolved per user's local timezone |
| Design | One token file — `apps/mobile/src/theme.ts`. No hex values or magic numbers in any StyleSheet. |

```
apps/mobile/          Expo app
  app/                Expo Router routes — today, schedule-builder, onboarding, account
  src/components/     BlockCard, CheckInSheet, BlockFormSheet, StreakStrip
  src/lib/            schedule.ts (swap, reschedule, displacement), preempt.ts, recurrence.ts
  src/theme.ts        design tokens, single source of truth
supabase/
  migrations/         schema
  functions/          nightly-notify, weekly-insight
docs/index.html       the interactive demo (GitHub Pages)
docs/engine.html      behavioral engine overview
```

## Running it

```bash
yarn install
cp apps/mobile/.env.example apps/mobile/.env
# EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
# ANTHROPIC_API_KEY is a Supabase edge function secret — never client-side
# Migrations are applied by hand in the Supabase SQL Editor, in order.
# `supabase db push` does not work on this project.
yarn mobile
```

## License

All rights reserved. Readable, not reusable — see [LICENSE](LICENSE).

Built by [Belal Qureshi](https://github.com/mbquresh) in Houston, TX.
