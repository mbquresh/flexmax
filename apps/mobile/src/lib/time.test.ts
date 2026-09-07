import { describe, expect, it } from "vitest";
import { minutesToTime } from "./time";

describe("minutesToTime", () => {
  it("renders midnight at the start of the day as 12:00 AM", () => {
    expect(minutesToTime(0)).toBe("12:00 AM");
  });

  it("renders midnight at the end of the day as 12:00 AM, not noon", () => {
    expect(minutesToTime(1440)).toBe("12:00 AM");
  });
});
