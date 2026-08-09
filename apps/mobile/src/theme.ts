/**
 * FlexMax design tokens.
 * Single source of truth for colors, spacing, typography, and radii.
 * No hardcoded hex values or magic numbers in StyleSheets — import from here.
 */

export const lightColors = {
  // Backgrounds — warm neutrals. Surfaces sit ABOVE the background,
  // de-emphasized surfaces sit BELOW it.
  background: "#ECEAE6",
  surface: "#F8F8F6",
  surfaceNested: "#F2F1EE",
  surfaceDim: "#E1DCD7",

  // Primary — dusted blue. Lower saturation than v1 so it reads as a
  // deliberate cool accent against warm neutrals rather than a clash.
  primary: "#43698F",
  primaryBright: "#6494BE",
  primaryDeep: "#33526F",
  primaryDisabled: "#A9BCCE",
  primaryTint: "#DCE3EA",
  onPrimary: "#FFFFFF",

  text: "#211F1B",
  textSecondary: "#38352F",
  textMuted: "#6B655B",
  textFaint: "#8C8578",
  textPlaceholder: "#9C9488",
  textDisabled: "#ADA69A",

  border: "#D4CEC6",
  borderLight: "#E1DCD7",

  success: "#57BF9B",
  successTint: "#DCEFE5",
  danger: "#D9694A",
  dangerTint: "#F6E3DC",
  error: "#AF3630",
  errorTint: "#F6DFD9",
  errorBorder: "#D89C90",

  streak: "#57BF9B",
  streakMissed: "#B3ADA2",
  streakHousing: "#F8F8F6",
  streakBorder: "#D4CEC6",
  streakMuted: "#6B655B",
  streakSquare: "#EFEEEA",
  streakSquareToday: "#F2F1EE",

  ratingGoodBg: "#D9EFD6",
  ratingGoodText: "#2E7D32",
  ratingOkayBg: "#FAF2CC",
  ratingOkayText: "#9A7B0A",
  ratingBadBg: "#F7DDD8",
  ratingBadText: "#B03030",
  // Signal vocabulary — identical in both modes. The block card status bar
  // depends on these matching the check-in sheet exactly.
  ratingGoodBorder: "#00C853",
  ratingOkayBorder: "#FFD600",
  ratingBadBorder: "#FF1744",

  menuBarBlue: "#4E7599",
  menuBarInk: "#2B2822",
  menuBarCoral: "#CE7358",

  overlayScrim: "#000000",

  // Elevation is shadow-based in light, luminance-based in dark. A shadow is
  // darkness cast on a surface; at L* 15 the dark background has nothing
  // darker to receive it, so dark uses surface lightness instead. This mirrors
  // how iOS and Material handle the same problem.
  shadowRest: {
    shadowColor: "#2B2822",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  shadowLift: {
    shadowColor: "#2B2822",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
  },
} as const;

type WidenColorValue<T> = T extends string
  ? string
  : T extends {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
    }
    ? {
        shadowColor: string;
        shadowOffset: { width: number; height: number };
        shadowOpacity: number;
        shadowRadius: number;
      }
    : T;

// Mapped from lightColors keys; strings widen to string so dark hex differs.
export type Colors = { [K in keyof typeof lightColors]: WidenColorValue<typeof lightColors[K]> };

// Typed as Colors so TypeScript enforces key-for-key completeness.
// A missing token fails `npx tsc --noEmit` rather than rendering as undefined.
export const darkColors: Colors = {
  // Warm charcoal, not black. Keeping the background off zero is what gives
  // surfaceDim room to sit BELOW it — on #000 it would be indistinguishable.
  background: "#292621",
  surface: "#433E39",
  surfaceNested: "#332F2A",
  surfaceDim: "#1C1917",

  primary: "#7FA8CE",
  primaryBright: "#9DC0DE",
  primaryDeep: "#5B84A8",
  primaryDisabled: "#4A5A69",
  primaryTint: "#24323D",
  // Dark text on a light blue button — white would be low contrast here.
  onPrimary: "#1A1815",

  // Never pure white. #FFF on dark halates on OLED.
  text: "#EAE5DC",
  textSecondary: "#D2CCC2",
  textMuted: "#B3AA9F",
  textFaint: "#9B9287",
  textPlaceholder: "#867E73",
  textDisabled: "#716A60",

  border: "#625B51",
  borderLight: "#564F47",

  success: "#5FCBA6",
  successTint: "#16362D",
  danger: "#E07C5E",
  dangerTint: "#482820",
  error: "#E0685C",
  errorTint: "#4A2721",
  errorBorder: "#7A4038",

  streak: "#5FCBA6",
  streakMissed: "#5E594F",
  streakHousing: "#433E39",
  streakBorder: "#625B51",
  streakMuted: "#9B948A",
  streakSquare: "#332F2A",
  streakSquareToday: "#3A3730",

  // Fills invert; text lightens so it reads on them.
  ratingGoodBg: "#19371D",
  ratingGoodText: "#6FD47A",
  ratingOkayBg: "#38310D",
  ratingOkayText: "#E3C44A",
  ratingBadBg: "#4C2525",
  ratingBadText: "#F0736B",
  // Identical to light — see note above.
  ratingGoodBorder: "#00C853",
  ratingOkayBorder: "#FFD600",
  ratingBadBorder: "#FF1744",

  menuBarBlue: "#6E9AC4",
  // Was #2B2822 in light. On a dark field the ink bar of the brand mark must
  // invert or the tricolor logo loses a stripe entirely.
  menuBarInk: "#EAE5DC",
  menuBarCoral: "#DE8567",

  overlayScrim: "#000000",

  shadowRest: {
    shadowColor: "#2B2822",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  shadowLift: {
    shadowColor: "#2B2822",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  xs: 2,     // caps on hairline bars
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  pill: 16,
  round: 20,
} as const;

export const iconSizes = {
  xs: 12,   // inline with body/small text
  sm: 14,   // lock badges, inline meta
  md: 16,   // action circles, close buttons
  lg: 18,   // prominent dismiss
} as const;

export const typography = {
  // Negative tracking is what separates a designed headline from a default
  // bold one — SF sets loose at display sizes.
  display:   { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.6 },
  title:     { fontSize: 22, fontWeight: "600" as const, letterSpacing: -0.4 },
  heading:   { fontSize: 17, fontWeight: "600" as const, letterSpacing: -0.2 },

  body:      { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  bodyBold:  { fontSize: 15, fontWeight: "600" as const, lineHeight: 22 },

  small:     { fontSize: 13, fontWeight: "400" as const, lineHeight: 19 },
  smallBold: { fontSize: 13, fontWeight: "600" as const, lineHeight: 19 },

  // For paragraphs of body copy inside sheets and modals, where 19 is tight.
  smallRelaxed: { fontSize: 13, fontWeight: "400" as const, lineHeight: 20 },

  caption:   { fontSize: 12, fontWeight: "500" as const, letterSpacing: 0.1 },
  label:     { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.5 },
} as const;

/**
 * Tabular figures. Spread AFTER a typography token on any text containing
 * numbers in a vertical list — times, percentages, counts. Without this,
 * proportional numerals give "9:00" and "11:00" different widths and nothing
 * aligns down a column.
 *
 *   style={[styles.meta, numeric]}
 */
export const numeric = { fontVariant: ["tabular-nums"] as ("tabular-nums")[] };
