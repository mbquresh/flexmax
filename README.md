<p align="center">
  <img src="apps/mobile/assets/icon.png" width="96" alt="FlexMax">
</p>

<h1 align="center">FlexMax</h1>

<p align="center"><strong>Habit trackers watch you fail. FlexMax figures out why.</strong></p>

<p align="center">
  <a href="https://mbquresh.github.io/flexmax">Interactive demo</a> — every screen, tappable
</p>

---

FlexMax is an AI-powered behavioral accountability app for iOS. You build 
your day out of flexible time blocks. The app pays attention to what you 
actually do — what you complete, what you miss, what you swap, and why.

It is not a calendar app. Calendars and planners are mirrors: they show 
you your plan, and when you fall behind, they show you falling behind in 
gorgeous detail. FlexMax is built around the opposite moment — the missed 
block. Instead of a red X, you get a short reflection and a schedule that 
rebuilds around what's still possible today.

## Why it exists

Every popular planner works well when you're already doing well. The 
people who need one most — ambitious, capable, easily derailed — abandon 
app after app, not because features were missing, but because day three of 
a bad week made them feel like a failure.

Rescheduling a missed task moves the block. It doesn't ask why the block 
keeps getting missed. Miss the gym forty times and a planner will 
cheerfully schedule gym #41, identical to #1.

FlexMax counts. When a block has been missed three or more times, the 
recovery flow names the pattern instead of quietly relocating it, then 
offers the next real slot in the day.

## Core loop

1. Conversational AI onboarding builds a psychology profile (4 turns)
2. You build a schedule of time blocks — some flexible, some fixed anchors
3. Tips from your own answers shape the schedule as you build it
4. Timezone-aware notifications through the day
5. Check-ins: crushed it / partly / lost focus — the middle option is 
   where the signal is
6. Missed blocks open recovery: acknowledge, reflect, reschedule

## Status

**v1.4 — on TestFlight, internal testing.** Built solo.

Working: AI onboarding and psychology profile, schedule builder with 
drag-to-swap and fixed anchors, check-ins, miss reflections, missed-block 
recovery with reschedule, push notifications in each user's local 
timezone, rate-limited AI endpoints with the API key server-side only.

Not built yet: the full behavioral learning layer. Swap patterns, 
completion ratings, and removal reasons are captured but not yet read back 
— miss counts are the exception, and they already feed the recovery 
prompts. Also pending: payments, Screen Time shielding (awaiting an Apple 
entitlement), widgets, Watch.

The app is about half of what it should be. The magic is in the other half.

## Stack

| | |
|---|---|
| Mobile | Expo (React Native), Expo Router, Zustand, Reanimated |
| Backend | Supabase — Postgres + RLS, auth, edge functions, cron |
| AI | Claude API (claude-sonnet-4-6), called only from edge functions |
| Notifications | Expo Notifications, resolved per user's local timezone |
| Design | One token file — `apps/mobile/src/theme.ts`. No hex values or magic numbers in any StyleSheet. |

```
apps/mobile/          Expo app
  app/                Expo Router routes — today, schedule-builder, onboarding, account
  src/components/     BlockCard, RecoverySheet, CheckInSheet, StreakStrip
  src/theme.ts        design tokens, single source of truth
packages/ai/          Claude wrappers + prompt system
supabase/
  migrations/         schema
  functions/          onboarding-chat, extract-psychology-profile,
                      generate-schedule-tips, missed-block-recovery, nightly-notify
docs/index.html       the interactive demo published above
```

## Running it

```bash
yarn install
cp apps/mobile/.env.example apps/mobile/.env
# EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
# ANTHROPIC_API_KEY is a Supabase edge function secret — never client-side
npx supabase db push
yarn mobile
```

## License

All rights reserved. Readable, not reusable — see [LICENSE](LICENSE).

Built by [Belal Qureshi](https://github.com/mbquresh) in Houston, TX.
