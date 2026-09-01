import Constants from "expo-constants";
import { supabase } from "./supabase";

// extra.supabaseUrl is the same EXPO_PUBLIC_SUPABASE_URL already wired in
// app.config.ts and supabase.ts. Read it from extra rather than inventing
// a second source.
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string;

// The feed is deployed --no-verify-jwt and identified solely by the token
// in the query string. Never log or send this URL anywhere but the user's
// own share sheet.
export function feedUrl(token: string): string {
  return `${supabaseUrl}/functions/v1/calendar-feed?token=${token}`;
}

// webcal:// is the same URL with a different scheme. iOS and macOS
// register it, so tapping opens Calendar's subscribe flow directly
// instead of downloading a file or opening a browser. Every calendar
// service publishes webcal for this reason.
export function feedUrlWebcal(token: string): string {
  return feedUrl(token).replace(/^https:\/\//, "webcal://");
}

export async function enableCalendarFeed(): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_calendar_token", {
    p_rotate: false,
  });
  if (error) throw error;
  return data as string;
}

export async function rotateCalendarFeed(): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_calendar_token", {
    p_rotate: true,
  });
  if (error) throw error;
  return data as string;
}

export async function disableCalendarFeed(): Promise<void> {
  const { error } = await supabase.rpc("revoke_calendar_token");
  if (error) throw error;
}
