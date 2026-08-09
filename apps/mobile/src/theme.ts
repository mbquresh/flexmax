/**
 * FlexMax design tokens.
 * Single source of truth for colors, spacing, typography, and radii.
 * No hardcoded hex values or magic numbers in StyleSheets — import from here.
 */

export const colors = {
  // Backgrounds
  background: "#DCDCDC",        // main screen background
  surface: "#EDEDED",           // cards, sheets, inputs
  surfaceNested: "#E4E4E4",     // nested surfaces inside cards
  surfaceDim: "#D0D0D0",        // de-emphasized surfaces

  // Primary (blue)
  primary: "#3B6EA5",           // buttons, links, active states
  primaryBright: "#5B9BD5",     // highlights
  primaryDeep: "#2C4A6E",       // avatar, deep accents
  primaryDisabled: "#A8C0DC",
  primaryTint: "#DCE6F2",       // tinted card backgrounds (tips, summary)
  onPrimary: "#FFFFFF",         // text on primary buttons

  // Text
  text: "#1E1E1E",              // primary text
  textSecondary: "#333333",
  textMuted: "#666666",
  textFaint: "#888888",
  textPlaceholder: "#999999",
  textDisabled: "#AAAAAA",

  // Borders
  border: "#C4C4C4",
  borderLight: "#CCCCCC",

  // Status
  success: "#5DCAA5",           // completed
  successTint: "#DFF3EA",       // reschedule box bg
  danger: "#D9694A",            // missed
  dangerTint: "#F8E5E0",
  error: "#B03030",
  errorTint: "#F8E0E0",
  errorBorder: "#D99999",

  // Streak (teal earned / neutral housing)
  streak: "#5DCAA5",
  streakMissed: "#A8B4BE", // muted slate — accounted but not completed
  streakHousing: "#EDEDED",
  streakBorder: "#C4C4C4",
  streakMuted: "#666666",
  streakSquare: "#E0E0E0",
  streakSquareToday: "#E4E4E4",

  // Pale semantic fills for check-in ratings
  ratingGoodBg: "#D8EFD8",     // pale green — crushed it
  ratingGoodText: "#2E7D32",
  ratingOkayBg: "#FBF3D0",     // pale yellow — partly
  ratingOkayText: "#9A7B0A",
  ratingBadBg: "#F8DEDE",      // pale red — lost focus
  ratingBadText: "#B03030",
  ratingGoodBorder: "#00C853",   // neon green — crushed it
  ratingOkayBorder: "#FFD600",   // neon yellow — partly
  ratingBadBorder: "#FF1744",   // neon red — lost focus

  // Menu button bars
  menuBarBlue: "#4B79AC",
  menuBarInk: "#2A2A2A",
  menuBarCoral: "#CE7358",

  // Modal scrim (opacity animated on top)
  overlayScrim: "#000000",
} as const;

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
