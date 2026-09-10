import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

export type EventName =
  | "onboarding_screen_viewed"
  | "onboarding_completed"
  | "schedule_builder_opened"
  | "block_added"
  | "schedule_first_saved"
  | "day_first_viewed"
  | "checkin_completed"
  | "block_missed_marked"
  | "recovery_opened"
  | "recovery_action"
  | "reflection_written"
  | "plan_tomorrow_opened"
  | "task_added"
  | "notification_opened"
  | "notification_permission"
  | "insight_viewed"
  | "insight_disputed"
  | "preempt_fired"
  | "preempt_opened";

export type EventProps = Record<string, string | number | boolean>;

export type NotificationOpenType =
  | "preempt"
  | "block_complete"
  | "cutoff"
  | "nightly";

export type PermissionStatus = "granted" | "denied" | "undetermined";

type CaptureFn = (name: string, props?: EventProps) => void;

let capture: CaptureFn | null = null;
let identifiedId: string | null = null;
let resetClient: (() => void) | null = null;
let identifyClient: ((id: string, props?: EventProps) => void) | null = null;
let registerClient: ((props: EventProps) => void) | null = null;
let initTried = false;

function apiKey(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  const fromExtra = Constants.expoConfig?.extra?.posthogKey as string | undefined;
  const key = fromEnv || fromExtra;
  return key && key.length > 0 ? key : undefined;
}

function host(): string {
  const fromEnv = process.env.EXPO_PUBLIC_POSTHOG_HOST;
  const fromExtra = Constants.expoConfig?.extra?.posthogHost as string | undefined;
  return fromEnv || fromExtra || "https://us.i.posthog.com";
}

function captureHttp(name: string, props?: EventProps): void {
  const key = apiKey();
  if (!key) return;
  fetch(`${host().replace(/\/$/, "")}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      event: name,
      distinct_id: identifiedId ?? "anonymous",
      properties: props ?? {},
    }),
  }).catch(() => {});
}

function ensureClient(): void {
  if (initTried) return;
  initTried = true;
  const key = apiKey();
  if (!key) return;

  try {
    // Lazy so vitest and a missing native module cannot crash import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PostHog = require("posthog-react-native").default;
    const client = new PostHog(key, {
      host: host(),
      personProfiles: "identified_only",
      captureAppLifecycleEvents: false,
    });
    capture = (name, props) => {
      client.capture(name, props);
    };
    identifyClient = (id, props) => {
      client.identify(id, props);
    };
    registerClient = (props) => {
      client.register(props);
    };
    resetClient = () => {
      client.reset();
    };
  } catch {
    capture = captureHttp;
    identifyClient = (id, props) => {
      identifiedId = id;
      captureHttp("$identify", props);
    };
    registerClient = () => {};
    resetClient = () => {
      identifiedId = null;
    };
  }
}

export function identifyUser(userId: string, superProps?: EventProps): void {
  try {
    identifiedId = userId;
    ensureClient();
    identifyClient?.(userId, superProps);
    if (superProps) registerClient?.(superProps);
  } catch {
    if (process.env.NODE_ENV !== "production") {
      console.log("[analytics] identify failed");
    }
  }
}

export function track(name: EventName, props?: EventProps): void {
  try {
    ensureClient();
    capture?.(name, props);
  } catch {
    if (process.env.NODE_ENV !== "production") {
      console.log("[analytics] track failed", name);
    }
  }
}

export function resetAnalytics(): void {
  try {
    identifiedId = null;
    ensureClient();
    resetClient?.();
  } catch {
    if (process.env.NODE_ENV !== "production") {
      console.log("[analytics] reset failed");
    }
  }
}

export function reflectionLengthBucket(len: number): "short" | "medium" | "long" {
  if (len < 40) return "short";
  if (len < 120) return "medium";
  return "long";
}

export function normalizePermissionStatus(status: string): PermissionStatus {
  if (status === "granted" || status === "denied" || status === "undetermined") {
    return status;
  }
  if (status === "provisional" || status === "ephemeral") return "granted";
  return "undetermined";
}

export function notificationTypeFromData(type: unknown): NotificationOpenType | null {
  if (type === "block_preempt") return "preempt";
  if (type === "block_complete") return "block_complete";
  if (type === "block_cutoff") return "cutoff";
  if (type === "nightly_fill") return "nightly";
  return null;
}

/** Persist-then-fire so a reload cannot emit the same first-time event twice. */
export function trackOnce(
  storageKey: string,
  name: EventName,
  props?: EventProps
): void {
  AsyncStorage.getItem(storageKey)
    .then((seen) => {
      if (seen) return;
      return AsyncStorage.setItem(storageKey, "1").then(() => {
        track(name, props);
      });
    })
    .catch(() => {});
}

export function trackReflection(text: string | null | undefined): void {
  const len = text?.trim().length ?? 0;
  if (len === 0) return;
  track("reflection_written", { length_bucket: reflectionLengthBucket(len) });
}

export function firstSavedKey(userId: string): string {
  return `analytics_schedule_first_saved_${userId}`;
}

export function firstDayKey(userId: string): string {
  return `analytics_day_first_viewed_${userId}`;
}

export function firstCheckinKey(userId: string): string {
  return `analytics_checkin_first_${userId}`;
}

export function preemptFiredKey(userId: string, date: string, instanceId: string): string {
  return `analytics_preempt_fired_${userId}_${date}_${instanceId}`;
}

export function trackCheckin(userId: string, rating: string): void {
  const key = firstCheckinKey(userId);
  AsyncStorage.getItem(key)
    .then((seen) => {
      const isFirst = !seen;
      if (isFirst) {
        return AsyncStorage.setItem(key, "1").then(() => {
          track("checkin_completed", { rating, is_first: true });
        });
      }
      track("checkin_completed", { rating, is_first: false });
    })
    .catch(() => {
      track("checkin_completed", { rating, is_first: false });
    });
}
