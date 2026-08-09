/**
 * FlexMax haptic vocabulary.
 * Single source of truth for physical feedback semantics.
 * Never call expo-haptics directly from a component — import a named
 * function from here.
 *
 * Discipline: haptics confirm INPUT, not network results. Fire at the moment
 * of the tap or gesture, never after an await. A buzz that arrives after a
 * round-trip reads as lag, not confirmation.
 *
 * All calls are fire-and-forget. Never await them.
 */
import * as Haptics from "expo-haptics";

/** A discrete choice was registered. Rating tap, toggle. */
export function hapticSelect() {
  Haptics.selectionAsync();
}

/** A card was lifted for dragging. */
export function hapticPickUp() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** A swipe reached its detent and snapped open. */
export function hapticDetent() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** A structural change landed — swap committed, block removed. */
export function hapticCommit() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** A block was marked missed. Acknowledgement, not admonishment. */
export function hapticMissed() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** An action was refused — collision, invalid state. */
export function hapticReject() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
