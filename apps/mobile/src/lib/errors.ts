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
  // supabase-js catches transport failures internally and returns them as
  // { error }, which callers rethrow — so they arrive here as PLAIN OBJECTS,
  // not Error instances. PostgREST errors carry a populated `code`
  // ("42501" RLS, "23505" unique violation); transport failures do not.
  if (err && typeof err === "object") {
    const e = err as { code?: string; message?: string; name?: string };
    const hasPostgrestCode = typeof e.code === "string" && e.code.length > 0;
    if (hasPostgrestCode) return false;

    const text = `${e.name ?? ""} ${e.message ?? ""}`;
    if (
      text.includes("AbortError") ||
      text.includes("Network request failed") ||
      text.includes("Failed to fetch") ||
      text.includes("Aborted")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * supabase-js returns transport failures as { error } rather than throwing.
 * PostgREST errors carry a populated `code`; fetch/abort failures do not.
 * Without this check, the write queue deletes entries when offline.
 */
export function isTransportErrorResult(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return !code || code.length === 0;
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
