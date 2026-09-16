# Offline mode — deferred spec

**Status:** designed, not built. Deferred 2026-08-20 to protect the beta window.
**Prerequisite:** nothing. This can start cold.
**Do not start this** without reading the failure history below. It has been
attempted once and reverted.

---

## The decision

> **Recording works offline. Planning requires a connection.**

That sentence is the whole scope. It is mechanical to apply at a new write
site and it matches what a user would guess: reporting on your day works in a
basement, restructuring your schedule needs signal.

### Why this line and not "everything offline"

Three things genuinely cannot go local-first:

- **`swap_instance_times`** — server-side RPC. Offline support means
  reimplementing anchor-rebuild in TypeScript. That logic took five
  iterations to get right; two copies that must agree is a standing bug
  source.
- **`generate_my_daily_instances`** — server-side materialization. Offline at
  midnight means the new day has no rows to write *to*.
- **`profiles` insert, `push_tokens`** — account bootstrap and push
  registration. Meaningless without a network by definition.

### Why this line and not "online only"

The uninstall moment is not "I couldn't read my weekly recap on a plane." It
is **"I did the thing and the app wouldn't let me record it."** At $14.99/mo
with no trial, that is a churn event. Recording is the product; everything
else can wait until signal returns.

### Why not gating alone

A connectivity check returns "online" on one bar. The gate does not fire, the
request hangs, and the user gets a perma-load anyway. Gating only handles
clean airplane mode — the *rarest* version of the problem. It is a useful
floor, not a solution.

---

## Trigger to revisit

Build this when any of these is true:

- Testers report lost writes, or the evidence pack looks thinner than
  observed behavior implies.
- Reopen rate after a bad week (the north-star metric) is being read
  seriously — silent write loss and disengagement are indistinguishable in
  that number.
- Post-beta, before any paid acquisition.

---

## Failure history — read before writing code

An AsyncStorage-backed write queue was built, documented, and reverted the
same day (2026-08-09, branch `offline-queue-attempt`). Two failures
compounded:

1. **Transport errors were never detected.** supabase-js catches fetch
   failures internally and returns them as `{ error }`. Callers rethrew
   **plain objects**, so every `instanceof Error` check in `isTransportError`
   returned false. Every offline write was rolled back instead of queued.
2. **A global 5s fetch timeout was added** to reduce offline stalls. It also
   governed Supabase auth token refresh, so a slow cold-start refresh aborted
   and the app failed to open at all.

The feature shipped, was documented, and **never worked once** — it was never
tested with the network actually off.

### Rules that follow from that

- **Never `instanceof Error`.** PostgREST errors carry a populated `code`;
  transport failures do not. That is the detection rule. `isConnectivityError`
  in `src/lib/errors.ts` already implements it — reuse it, do not write a
  second one.
- **Never a global fetch timeout.** Auth and data need separate timeouts, or
  none. `createClient` in `src/lib/supabase.ts` is currently clean — keep it
  that way.
- **Airplane mode is the acceptance criterion after every step, not a final
  pass.** If a step cannot be verified with the radio off, it is not done.

---

## What queues

Only updates to existing rows in `daily_schedule_instances`:

| Field | Written by |
|---|---|
| `status` | check-in, swipe-to-missed, undo, close-today sweep |
| `completion_rating` | check-in |
| `reflection_why`, `reflection_improve` | recovery sheet |
| `miss_reason_tag` | close-today preset chips |
| `acknowledged_at` | client-supplied, see below |

All are patches to rows that already exist. Last-write-wins, idempotent, no
client-generated UUIDs, no insert reconciliation, no RPC replay.

## What does not queue

Everything else. `swap_instance_times`, `generate_my_daily_instances`,
`adhoc_tasks` CRUD, `schedule_blocks` / `schedule_templates`, `day_log`,
`nudge_events`, `profiles`, `push_tokens`, onboarding.

These surface an error via the existing `handleError` path and are left alone.

---

## The trap: `acknowledged_at`

Migration 024's `stamp_acknowledged` trigger stamps `now()` at **DB write
time**. A queued write that lands six hours late stamps six hours late — on
the one column built specifically because it cannot be backfilled. Recovery
time would be silently corrupted for exactly the users with bad connectivity,
and it would look like real behavioral data.

So the client must send `acknowledged_at` as the moment of the tap, and the
trigger must respect it within sane bounds.

**Note on `toISOString()`:** the repo rule is never use it for date
operations — use `getLocalDateString()`. That rule is about *calendar dates*,
where UTC conversion shifts you a day. `acknowledged_at` is a `timestamptz`,
an absolute instant, so `toISOString()` is correct here. Do not "fix" this.

**Device clocks can be wrong or deliberately changed.** Out-of-bounds values
fall back to `now()` rather than being rejected — a slightly wrong timestamp
beats a lost acknowledgment.

---

## Build order

Four steps. Airplane-mode test after each, before starting the next.

### Step 1 — SQL, applied via Supabase SQL Editor

`supabase db push` is broken. Paste this directly. The trigger already exists
and is bound to the function, so `create or replace` is the whole change — no
`drop trigger` needed.

```sql
-- 027: allow a client-supplied acknowledged_at, clamped.
create or replace function public.stamp_acknowledged()
returns trigger as $$
declare
  supplied timestamptz;
  floor_ts timestamptz;
begin
  if new.status is distinct from old.status then

    if new.status in ('completed','missed','skipped')
       and old.acknowledged_at is null then

      -- Did this UPDATE explicitly carry an acknowledged_at? On a normal
      -- patch the column is absent and new = old, so this is false.
      if new.acknowledged_at is distinct from old.acknowledged_at
         and new.acknowledged_at is not null then

        supplied  := new.acknowledged_at;
        -- One day of slack below the instance's own date absorbs timezone
        -- offset. Guards against a clock set to 2019, not minutes.
        floor_ts  := (new.date::timestamptz - interval '1 day');

        if supplied > now() or supplied < floor_ts then
          new.acknowledged_at := now();
        else
          new.acknowledged_at := supplied;
        end if;

      else
        new.acknowledged_at := now();
      end if;

    elsif new.status in ('pending','active') then
      new.acknowledged_at := null;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
```

**Verify against a throwaway row before writing any client code:**

1. No supplied value → stamps `now()`, within seconds.
2. Supplied value two hours ago → preserved exactly.
3. Supplied value `now() + interval '2 days'` → falls back to `now()`, **not**
   the future value.
4. Revert to `pending` → `acknowledged_at` is null again.

Case 3 is the one that matters. If a future timestamp survives, the clamp is
not firing and every recovery-time number afterward is suspect.

### Step 2 — queue module

`src/lib/writeQueue.ts`. AsyncStorage-backed.

- Entry shape: `{ instanceId, patch, queuedAt }`.
- **Coalesce by `instanceId` on enqueue**, merging patches. A user who marks a
  block missed then completed should produce one write, not two.
- Preserve the **earliest** `queuedAt` when coalescing — that is the
  acknowledgment moment.
- Flush on: app foreground, successful write elsewhere, and app launch.
- Detect transport failure with the existing `isConnectivityError`.
- On flush failure, leave the entry in place. Never drop an entry to unstick
  a queue.

Route the instance-update sites through it. Every one keeps its existing
optimistic local update — that part already works.

### Step 3 — reload replay

The zustand store is not persisted. On restart, the UI rebuilds from the
server, which does not have the queued writes yet. Without replay, the user
reopens the app and watches completed blocks revert to pending — worse than
the bug being fixed, because it looks like the app lost their work.

`loadToday` must apply pending queue patches on top of the server response
before `setTodayInstances`.

### Step 4 — offline indicator

Something small and non-modal on Today: pending write count, or a quiet
"saved locally, will sync" line. The user must be able to tell the difference
between "saved" and "saved to the server." Do not use an Alert — this is
ambient state, not an error.

---

## Open questions

- **Flush ordering with partial failure.** If entry 3 of 7 fails, do 4–7
  proceed? Coalescing by row means entries are independent, so probably yes —
  but confirm before assuming.
- **Queue age cap.** A write queued for a week is arguably stale. No opinion
  yet; needs a real tester with a real gap.
- **Interaction with the close-today sweep.** The sweep writes several rows in
  quick succession. Confirm coalescing does not merge across distinct
  instances.
