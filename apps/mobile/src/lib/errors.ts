import { Alert, Platform } from "react-native";

/**
 * Normalize any thrown value into a readable message.
 * Handles Error instances, Supabase error objects, plain objects, and strings.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    // Supabase errors often have a `message` field
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === "string") return maybeMessage;
    try {
      return JSON.stringify(err);
    } catch {
      return "An unknown error occurred";
    }
  }
  return "An unknown error occurred";
}

export function isConnectivityError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" && code.length > 0) return false;
  const message = getErrorMessage(err).toLowerCase();
  return (
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("network error") ||
    message.includes("connection appears to be offline") ||
    code === undefined ||
    code === ""
  );
}

let lastAlertAt = 0;
const ALERT_DEDUPE_MS = 3000;

/**
 * Standard error handler. Logs for debugging and optionally shows the user
 * a friendly message via Alert.
 *
 * @param err       the caught error
 * @param context   short label for logs, e.g. "loadToday", "saveProfile"
 * @param userMessage  optional friendly message to show the user via Alert.
 *                     If omitted, no Alert is shown (silent-but-logged).
 */
export function handleError(
  err: unknown,
  context: string,
  userMessage?: string
): void {
  const message = getErrorMessage(err);
  console.error(`[${context}]`, message, err);

  if (!userMessage || Platform.OS === "web") return;

  const now = Date.now();
  if (now - lastAlertAt < ALERT_DEDUPE_MS) return;
  lastAlertAt = now;

  if (isConnectivityError(err)) {
    Alert.alert(
      "You're offline",
      "This didn't save. Reconnect and try again."
    );
  } else {
    Alert.alert("Something went wrong", userMessage);
  }
}
