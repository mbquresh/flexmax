// Shared by CloseTodayRow (evening sweep) and the recovery route.
// miss_reasons in get_behavior_evidence groups by exact string value —
// if these ever diverge between surfaces, one reason becomes two rows.
export const MISS_REASON_PRESETS = [
  "Ran out of time",
  "Low energy",
  "Something came up",
  "Chose something else",
  "Lost track of time",
] as const;
