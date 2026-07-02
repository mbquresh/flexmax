# FlexMax

> A 24/7 life optimization agent that keeps you on track through psychology-aware scheduling, AI accountability, and smart behavioral nudges.

## Interactive mockup

Browse the full app mockup (all screens side-by-side): **[mbquresh.github.io/flexmax](https://mbquresh.github.io/flexmax/)**

Source: [`docs/index.html`](docs/index.html) — enable GitHub Pages with **Settings → Pages → Build from `/docs`**.

## What this is

FlexMax is not a calendar app. It's a behavioral accountability system built around how humans actually work — avoidance loops, motivation patterns, distraction tendencies — and it learns yours.

**Core loop:**
1. AI onboarding learns your psychology (goals, tendencies, sabotage patterns)
2. You build a weekly schedule with draggable time blocks (quick-add presets + custom blocks)
3. AI coaching tips guide how you set up blocks — no auto-generated schedule
4. Each night, you fill in what you'll actually do in each block (nightly push notification)
5. Smart notifications hold you accountable through the day
6. Missed blocks trigger AI reflection + in-place rescheduling

## Repo structure

```
flex_max/
├── apps/
│   └── mobile/          # Expo React Native app
│       ├── app/         # Expo Router routes
│       └── src/
│           ├── screens/
│           ├── providers/
│           ├── lib/
│           ├── store/
│           └── types/
├── packages/
│   └── ai/              # Claude API wrappers + prompt system
└── supabase/
    ├── migrations/      # Database schema
    └── functions/       # Edge functions (notifications, cron)
```

## Tech stack

- **Mobile**: Expo (React Native) — push notifications, cross-platform mobile
- **Backend**: Supabase — auth, Postgres, realtime, edge functions
- **AI**: Anthropic Claude API (claude-sonnet-4-6)
- **State**: Zustand
- **Notifications**: Expo Notifications + Supabase Edge Functions cron

## Status

Work in progress. **v1 and v1.1 are complete**, v1.2 in progress.

**Live now:**
- AI onboarding (Claude-powered psychology profile extraction)
- Schedule builder with AI coaching tips, quick-add presets, custom blocks, day toggles, inline editing
- Today view: check-ins with completion ratings, drag-to-swap blocks, task detail entry, undo, missed-block recovery
- Missed block recovery: AI reflection prompts + in-place rescheduling
- Weekly streak tracking + completion rate
- Account screen: psychology profile summary, editable name, redo onboarding
- Push token registration
- Nightly fill-in push notifications (pg_cron)
- Post-block check-in notifications (local device scheduling)
- Light grey + blue theme

## Getting started

```bash
# Install dependencies
yarn install

# Set up environment variables
cp apps/mobile/.env.example apps/mobile/.env
# Fill in: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
# ANTHROPIC_API_KEY lives server-side only (Supabase edge function secret)

# Push Supabase schema
npx supabase db push

# Start mobile app
yarn mobile
```

## Roadmap

### v1 — complete
- Repo structure, Supabase schema + auth
- AI onboarding chat (4-turn intake → psychology profile)
- Schedule builder (blocks, presets, day toggles, inline editing)
- AI schedule tips (profile-aware coaching)
- Today view (daily instances, check-ins, drag-to-swap, missed-block recovery)

### v1.1 — complete
- Nightly task-fill notifications (pg_cron)
- Post-block accountability check-ins (local scheduling)
- Missed block recovery flow (AI reflection + in-place reschedule)

### v1.2 — in progress
- Weekly streak + completion rate (done)
- Account screen + psychology profile summary (done)
- Light grey + blue theme (done)
- App icon

### v2 — planned
- Behavioral learning: psychology profile evolves from actual completion patterns
- Activity idle detection (requires native build)
- Light/dark theme toggle
- Morning brief
- EAS build for reliable background notifications + TestFlight

**Deferred:** AI schedule review screen (replaced by coaching tips), idle detection (native-only, moved to v2).

## Name

**FlexMax** — flexibility meets optimization. The schedule bends to your life; the AI makes sure you don't use that as an excuse.
