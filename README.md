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
4. Each night, you fill in what you'll actually do in each block
5. Smart notifications hold you accountable through the day
6. Missed blocks trigger reflection + intelligent rescheduling

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

- **Mobile**: Expo (React Native) — push notifications, future background monitoring
- **Backend**: Supabase — auth, Postgres, realtime, edge functions
- **AI**: Anthropic Claude API (claude-sonnet-4-6)
- **State**: Zustand
- **Notifications**: Expo Notifications + Supabase Edge Functions cron

## Status

**Work in progress** — v1 core loop is live: auth, AI onboarding, manual schedule builder (with tips), and Today view. Drag-to-shift is still on the roadmap; AI schedule review is out of scope for now. Accountability features (notifications, check-ins, missed-block recovery) are next for v1.1.

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

## v1 scope (Jun 21)

- [x] Repo structure
- [x] Supabase schema + auth
- [x] AI onboarding chat (4-turn intake, saves psychology profile)
- [x] Schedule builder (add/delete blocks, quick-add presets, day toggles)
- [x] AI schedule tips (profile-aware coaching on first visit)
- [x] Today view (daily instances from template blocks)
- [ ] Schedule builder — drag to shift blocks

**Deferred (not building for v1):** AI schedule review screen.

## v1.1 scope (Jun 28)

- [ ] Nightly task-fill notifications
- [ ] Post-block accountability check-ins
- [ ] Missed block recovery flow (reflect + reschedule)
- [ ] Basic activity idle detection

## Name

**FlexMax** — flexibility meets optimization. The schedule bends to your life; the AI makes sure you don't use that as an excuse.
