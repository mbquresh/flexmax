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

/** True for network/timeout failures. False for Supabase server rejections. */
export function isTransportError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === "Network request failed") {
    return true;
  }
  if (err instanceof Error && err.name === "AbortError") {
    return true;
  }
  if (
    typeof DOMException !== "undefined" &&
    err instanceof DOMException &&
    err.name === "AbortError"
  ) {
    return true;
  }
  return false;
}

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

  if (userMessage && Platform.OS !== "web") {
    Alert.alert("Something went wrong", userMessage);
  }
}
