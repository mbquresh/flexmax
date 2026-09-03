// calendar-feed
//
// Serves the user's schedule as an ICS subscription feed. Deploy with:
//   supabase functions deploy calendar-feed --no-verify-jwt
//
// PUBLICLY REACHABLE BY DESIGN. Calendar clients cannot send Authorization
// headers, so the token in the query string is the only thing guarding this.
// Consequences that shape the code below:
//   * unknown token returns 404, never 401 -- a 401 confirms that the token
//     space is meaningful and turns this into an oracle
//   * the response carries block names and times only. Never reflections,
//     insights, miss reasons, ratings or anything else
//   * known tokens are rate-limited per user (60/hour) after lookup. Unknown
//     tokens 404 without incrementing, so a 429 cannot confirm the space.
//
// WHY THE TEMPLATE AND NOT THE INSTANCES: Google refreshes subscribed feeds
// every 12-24 hours with no faster setting (Apple is hourly, configurable to
// 5 minutes). Publishing daily instances would show a Google user yesterday's
// arrangement all day -- confidently wrong, and uncorrectable from here. The
// template changes only when the user edits their schedule, which matches the
// refresh cadence. The calendar holds the plan; the app holds the day.
//
// FLOATING TIME, deliberately. DTSTART carries no Z and no TZID, so a 9am
// block renders as 9am wherever the viewing device is. A FlexMax block is
// "9am my time", not an absolute instant, and floating time also avoids
// emitting a VTIMEZONE component that clients disagree about.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

// RFC 5545 3.3.11: backslash, semicolon and comma must be escaped in TEXT
// values, and newlines become the literal two characters \n. A block named
// "Gym, then shower" silently corrupts the feed without this.
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC 5545 3.1: lines are folded at 75 OCTETS, not characters. Google rejects
// feeds with overlong lines. Fold on the UTF-8 byte length so a multi-byte
// character is never split across the boundary.
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  const limit = () => (out.length === 0 ? 75 : 74); // continuation lines lose one octet to the leading space

  for (const ch of line) {
    const chBytes = new TextEncoder().encode(ch).length;
    if (currentBytes + chBytes > limit()) {
      out.push(current);
      current = "";
      currentBytes = 0;
    }
    current += ch;
    currentBytes += chBytes;
  }
  if (current) out.push(current);

  return out.join("\r\n ");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function minutesToTime(mins: number): string {
  return `${pad(Math.floor(mins / 60))}${pad(mins % 60)}00`;
}

function dateToICS(iso: string): string {
  return iso.replace(/-/g, "");
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function dowOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// DTSTART must be the block's FIRST occurrence on or after its anchor, not
// today. RRULE counts INTERVAL from DTSTART, so a DTSTART on the wrong week
// puts every biweekly occurrence on the wrong weeks.
function firstOccurrence(
  anchor: string,
  days: number[]
): string | null {
  for (let i = 0; i < 14; i++) {
    const candidate = addDays(anchor, i);
    if (days.includes(dowOf(candidate))) return candidate;
  }
  return null;
}

function* eachDate(start: string, end: string): Generator<string> {
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 400) {
    yield cur;
    cur = addDays(cur, 1);
    guard++;
  }
}

serve_handler();

function serve_handler() {
  Deno.serve(async (req: Request) => {
    try {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");

      // 404 rather than 401 on a missing or unknown token. A 401 would confirm
      // that the token space is meaningful and make this an oracle.
      if (!token || token.length < 32) {
        console.warn("[calendar-feed] 404 malformed or missing token");
        return new Response("Not found", { status: 404 });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, timezone, calendar_feed_token")
        .eq("calendar_feed_token", token)
        .maybeSingle();

      if (profileErr) {
        console.error("[calendar-feed] 500 profile lookup", profileErr);
        return new Response("Server error", { status: 500 });
      }
      if (!profile) {
        console.warn("[calendar-feed] 404 unknown token");
        return new Response("Not found", { status: 404 });
      }

      const userId = profile.id as string;

      const { allowed } = await checkRateLimit(userId, "calendar-feed");
      if (!allowed) {
        console.warn(`[calendar-feed] 429 rate limited user=${userId}`);
        return new Response("Too many requests", {
          status: 429,
          headers: { "Retry-After": "3600" },
        });
      }

      const { data: blocks, error: blocksErr } = await supabase
        .from("schedule_blocks")
        .select(
          "id, name, start_minutes, end_minutes, days_of_week, is_fixed, is_active, starts_on, ends_on, interval_weeks, anchor_date, created_at"
        )
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("start_minutes");

      if (blocksErr) {
        console.error("[calendar-feed] 500 blocks", blocksErr);
        return new Response("Server error", { status: 500 });
      }

      const { data: exceptions } = await supabase
        .from("block_exceptions")
        .select("block_id, date")
        .eq("user_id", userId);

      const { data: away } = await supabase
        .from("away_periods")
        .select("starts_on, ends_on")
        .eq("user_id", userId);

      // ICS has no user-level absence concept, so an away period becomes an
      // EXDATE on every block for every day it covers.
      const awayDates = new Set<string>();
      for (const period of away ?? []) {
        for (const d of eachDate(period.starts_on, period.ends_on)) {
          awayDates.add(d);
        }
      }

      const exByBlock = new Map<string, Set<string>>();
      for (const ex of exceptions ?? []) {
        const set = exByBlock.get(ex.block_id) ?? new Set<string>();
        set.add(ex.date);
        exByBlock.set(ex.block_id, set);
      }

      const now = new Date();
      const stamp =
        `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
        `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

      const lines: string[] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//FlexMax//Schedule//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:FlexMax",
        "X-WR-CALDESC:Your FlexMax schedule",
      ];

      for (const b of blocks ?? []) {
        const days: number[] = b.days_of_week ?? [];
        if (!days.length) continue;

        const anchor =
          b.anchor_date ?? b.starts_on ?? String(b.created_at).slice(0, 10);
        const first = firstOccurrence(anchor, days);
        if (!first) continue;

        const byDay = days
          .slice()
          .sort((x, y) => x - y)
          .map((d) => DAY_CODES[d])
          .join(",");

        const interval = b.interval_weeks ?? 1;

        let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`;
        if (interval > 1) rrule += `;INTERVAL=${interval}`;
        // WKST affects how INTERVAL counts weeks for a rule whose BYDAY spans
        // the week boundary. Fixed to MO so the output is at least
        // deterministic across clients.
        if (interval > 1) rrule += ";WKST=MO";
        if (b.ends_on) {
          // RFC 5545: UNTIL must match DTSTART's value type. DTSTART is
          // floating, so UNTIL is floating too -- no trailing Z.
          rrule += `;UNTIL=${dateToICS(b.ends_on)}T${minutesToTime(b.end_minutes)}`;
        }

        const skipped = new Set<string>([
          ...(exByBlock.get(b.id) ?? []),
          ...awayDates,
        ]);
        // Only exclude dates this block would actually fall on, or clients
        // warn about EXDATEs that match no occurrence.
        const relevant = [...skipped]
          .filter((d) => days.includes(dowOf(d)) && d >= first)
          .sort();

        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${b.id}@flexmax.app`);
        lines.push(`DTSTAMP:${stamp}`);
        lines.push(`SUMMARY:${escapeText(b.name)}`);
        lines.push(`DTSTART:${dateToICS(first)}T${minutesToTime(b.start_minutes)}`);
        lines.push(`DTEND:${dateToICS(first)}T${minutesToTime(b.end_minutes)}`);
        lines.push(rrule);
        if (relevant.length) {
          lines.push(
            `EXDATE:${relevant
              .map((d) => `${dateToICS(d)}T${minutesToTime(b.start_minutes)}`)
              .join(",")}`
          );
        }
        lines.push("TRANSP:OPAQUE");
        lines.push("END:VEVENT");
      }

      lines.push("END:VCALENDAR");

      console.log(
        `[calendar-feed] served user=${userId} blocks=${blocks?.length ?? 0}`
      );

      // CRLF is required by RFC 5545. LF-only feeds are accepted by some
      // clients and rejected by others.
      const body = lines.map(fold).join("\r\n") + "\r\n";

      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          // Token-bearing per-user URL. public would let a shared cache
          // serve one person's schedule to the next requester.
          "Cache-Control": "private, max-age=3600",
          "Content-Disposition": 'inline; filename="flexmax.ics"',
        },
      });
    } catch (err) {
      // Detail to the logs, never to an unauthenticated caller.
      console.error("[calendar-feed] 500 unhandled", err);
      return new Response("Server error", { status: 500 });
    }
  });
}
