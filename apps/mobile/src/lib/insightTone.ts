import { Colors } from "../theme";

export function insightTone(kind: string, c: Colors) {
  switch (kind) {
    case "strength":
      return {
        stripe: c.ratingGoodBorder,
        ink: c.ratingGoodText,
        tint: c.ratingGoodBg,
      };
    case "structural":
      return {
        stripe: c.menuBarCoral,
        ink: c.menuBarCoral,
        tint: c.dangerTint,
      };
    case "pattern":
      return {
        stripe: c.ratingOkayBorder,
        ink: c.ratingOkayText,
        tint: c.ratingOkayBg,
      };
    case "causal":
      return {
        stripe: c.ratingBadBorder,
        ink: c.ratingBadText,
        tint: c.ratingBadBg,
      };
    default:
      return { stripe: c.primary, ink: c.textMuted, tint: c.surface };
  }
}
