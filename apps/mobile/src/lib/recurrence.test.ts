import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {},
}));
import {
  describeRecurrence,
  formatEndDate,
} from "./recurrence";

describe("describeRecurrence", () => {
  it("returns Never when no days are selected", () => {
    expect(describeRecurrence([], 1, null)).toBe("Never");
    expect(describeRecurrence([], 3, "2026-09-04")).toBe("Never");
  });

  it("names all seven days as every day", () => {
    expect(describeRecurrence([0, 1, 2, 3, 4, 5, 6], 1, null)).toBe(
      "Every week on every day"
    );
  });

  it("names weekdays and weekends", () => {
    expect(describeRecurrence([1, 2, 3, 4, 5], 1, null)).toBe(
      "Every week on weekdays"
    );
    expect(describeRecurrence([0, 6], 1, null)).toBe(
      "Every week on weekends"
    );
  });

  it("joins an arbitrary subset in weekday order", () => {
    expect(describeRecurrence([3, 1], 1, null)).toBe(
      "Every week on Mon, Wed"
    );
  });

  it("uses Every N weeks when the interval is not 1", () => {
    expect(describeRecurrence([1, 2, 3, 4, 5], 3, null)).toBe(
      "Every 3 weeks on weekdays"
    );
  });

  it("appends a locally parsed end date", () => {
    expect(describeRecurrence([1, 2, 3, 4, 5], 1, "2026-09-04")).toBe(
      `Every week on weekdays · until ${formatEndDate("2026-09-04")}`
    );
  });
});
