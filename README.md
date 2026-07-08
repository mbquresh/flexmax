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
7. One-off ad-hoc tasks for today — timed (on the timeline) or anytime (secondary tray)

## Repo structure

```
flex_max/
├── apps/
│   └── mobile/          # Expo React Native app
│       ├── app/         # Expo Router routes
│       └── src/
│           ├── components/
│           ├── hooks/
│           ├── providers/
│           ├── lib/
│           ├── store/
│           └── types/
└── supabase/
    ├── migrations/      # Database schema
    ├── functions/       # Edge functions (notifications, cron)
    └── APPLY_IN_DASHBOARD.sql  # Manual SQL when db push is out of sync
```

## Tech stack

- **Mobile**: Expo (React Native) — push notifications, cross-platform mobile
- **Backend**: Supabase — auth, Postgres, realtime, edge functions
- **AI**: Anthropic Claude API (claude-sonnet-4-6)
- **State**: Zustand
- **Notifications**: Expo Notifications + Supabase Edge Functions cron

## Status

Work in progress. **v1, v1.1, v1.2, chassis hardening, v1.3, security & integrity hardening, and v1.4 complete.**

**Live now:**
- AI onboarding (Claude-powered psychology profile extraction)
- Schedule builder: AI coaching tips, quick-add presets, custom blocks, inline editing, fixed/flexible blocks, native time picker
- Today view: check-ins with semantic ratings, drag-to-swap from handle rail (respects fixed blocks + protected gaps), task detail entry, undo, missed-block recovery, reset today
- Block cards: swipe-left reveals Missed + Remove actions; bidirectional swipe to close; scroll/drag/swipe coexist without conflict
- Swipe-to-remove blocks from today (optional reason, excluded from stats and swap targets)
- Ad-hoc today tasks: full-width coral add button; timed tasks on timeline or anytime tasks in secondary tray
- Missed block recovery: AI reflection prompts + in-place rescheduling
- Weekly streak tracking + completion rate (scheduled blocks only; ad-hoc tasks excluded for now)
- Account screen: psychology profile summary, editable name, redo onboarding, sign out
- Push token registration, nightly fill-in notifications (pg_cron), post-block check-in notifications (local scheduling)
- Light grey + blue theme with centralized design tokens

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
# If db push is out of sync, run pending migrations manually in the Supabase SQL editor
# (see supabase/APPLY_IN_DASHBOARD.sql)

# Start mobile app
yarn mobile
```

## Roadmap

### v1 — complete
Repo structure, Supabase schema + auth, AI onboarding, schedule builder, AI tips, Today view (check-ins, drag-to-swap, missed-block recovery).

### v1.1 — complete
Nightly task-fill notifications, post-block check-ins, missed block recovery flow.

### v1.2 — complete
Weekly streak + completion rate, account screen + psychology profile summary, light grey + blue theme.

### Chassis hardening — complete
Foundation work before v2 complexity:
- Centralized design tokens (`src/theme.ts`)
- Decomposed `today.tsx` into components + hooks
- Standardized error handling utility
- Streak calculation optimized (N+1 → single query)
- Dead code sweep (removed unused `packages/ai` workspace)

### v1.3 — complete
- Fixed/flexible blocks (inflexible anchors like work/commute)
- Adjacency-aware swap (unified anchor-rebuild, preserves gaps, never overflows day)
- Reset today
- Swipe-to-remove + swipe-to-missed (Apple Mail style gestures)
- Ad-hoc today tasks with "anytime today" tray

### Security & integrity hardening — complete
- Scoped generate_daily_instances (fixed cross-tenant write vulnerability)
- AsyncStorage session persistence (sessions survive app restarts)
- Atomic swap via transactional RPC
- Onboarding gate on protected routes
- Stats timezone consistency, reset rollback safety, cron doc fixes
- Notifications reschedule after block time changes

### v1.4 — complete
- Native time picker (iOS/Android wheel)
- Check-in ratings with semantic colors
- Schedule builder + Today UI polish

### v2 — planned
- Behavioral learning: psychology profile evolves from completion patterns
- Remaining hardening (see v2-issues.md): AI rate limiting, CHECK constraints, stack-trace audit, stale-request guard
- Dark theme + light/dark toggle (design tokens make this feasible)
- Activity idle detection (native build)
- Morning brief
- EAS build → TestFlight

## Name

**FlexMax** — flexibility meets optimization. The schedule bends to your life; the AI makes sure you don't use that as an excuse.
