# FlexMax — Setup & Deployment Guide

## Prerequisites

- Node.js 20+
- Yarn
- Expo CLI: `npm install -g expo-cli eas-cli`
- Supabase CLI: `npm install -g supabase`
- Anthropic API key

---

## 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/flex_max.git
cd flex_max
yarn install
```

---

## 2. Supabase setup

```bash
# Login
supabase login

# Link to your project (create one at supabase.com first)
supabase link --project-ref YOUR_PROJECT_REF

# Push the schema
supabase db push

# Set AI provider + API key (pick one):
supabase secrets set AI_PROVIDER=gemini
supabase secrets set GEMINI_API_KEY=your-key-here
# Or for production:
# supabase secrets set AI_PROVIDER=anthropic
# supabase secrets set ANTHROPIC_API_KEY=your-key-here
# Or scripted demo (no key):
# supabase secrets set AI_PROVIDER=demo

# Or run: ./scripts/setup-ai.sh gemini YOUR_GEMINI_KEY

# Deploy edge functions
supabase functions deploy onboarding-chat
supabase functions deploy extract-psychology-profile
supabase functions deploy nightly-notify
```

---

## 3. Mobile app environment

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Fill in `apps/mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Find these at: supabase.com → Project Settings → API

---

## 4. Run locally

```bash
yarn mobile
# Then press 'i' for iOS simulator or 'a' for Android emulator
# Or scan QR code with Expo Go on your phone
```

---

## 5. Schedule nightly notifications (pg_cron)

In Supabase SQL editor:

```sql
-- Enable pg_cron (if not already enabled in Supabase dashboard)
-- Then schedule nightly-notify to run at 2 AM UTC (9 PM CST)
select cron.schedule(
  'flexmax-nightly-notify',
  '0 2 * * *',
  $$
    select net.http_post(
      url := 'https://YOUR_PROJECT.supabase.co/functions/v1/nightly-notify',
      headers := json_build_object(
        'Authorization', 'Bearer ' || 'YOUR_SUPABASE_SERVICE_KEY'
      )::jsonb
    );
  $$
);
```

---

## 6. Deploy to TestFlight / Play Store (when ready)

```bash
# Configure EAS build
eas build:configure

# Build for iOS
eas build --platform ios --profile preview

# Submit to TestFlight
eas submit --platform ios
```

---

## Architecture decisions

**Why Supabase edge functions for AI calls?**
The Anthropic API key must never be in the mobile app bundle — it would be trivially extractable.
All Claude API calls proxy through Supabase edge functions, which store the key as an encrypted secret.

**Why minutes-since-midnight for time storage?**
- Simple integer arithmetic for block shifting (`start_minutes + 30`)
- No timezone ambiguity in storage
- Easy sorting (`order by start_minutes`)
- Convert to display strings only in the UI with `minutesToTime()`

**Why daily instances instead of querying blocks directly?**
Daily instances let each day be independent — you can shift a block on Tuesday without affecting Wednesday,
add a one-off block, or reschedule a missed block to a different time, all without touching the template.

---

## v1 checklist (Jun 21)

- [ ] Auth (Supabase email/password)
- [ ] Onboarding chat screen
- [ ] Psychology profile extraction + save
- [ ] Schedule builder (add/edit/delete blocks, drag to shift)
- [ ] AI schedule review screen
- [ ] Today view with block status

## v1.1 checklist (Jun 28)

- [ ] Nightly fill-in notification + task detail screen
- [ ] Post-block accountability check-in
- [ ] Missed block recovery flow
- [ ] Push token registration
- [ ] Nightly cron job
