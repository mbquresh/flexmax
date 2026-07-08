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

  // Streak (orange)
  streak: "#EF9F27",
  streakHousing: "#FBEFD9",
  streakBorder: "#F0D9A8",
  streakMuted: "#B07A28",
  streakSquare: "#F5E4C8",

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
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  pill: 16,
  round: 20,
} as const;

export const typography = {
  title: { fontSize: 22, fontWeight: "600" as const },
  heading: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  bodyBold: { fontSize: 15, fontWeight: "600" as const },
  small: { fontSize: 13, fontWeight: "400" as const },
  smallBold: { fontSize: 13, fontWeight: "600" as const },
  caption: { fontSize: 12, fontWeight: "500" as const },
  label: { fontSize: 11, fontWeight: "600" as const },
} as const;
