import { describe, expect, it } from "vitest";
import { interpretEndPick, minutesToDate, minutesToTime } from "./time";

describe("minutesToTime", () => {
  it("renders midnight at the start of the day as 12:00 AM", () => {
    expect(minutesToTime(0)).toBe("12:00 AM");
  });

  it("renders midnight at the end of the day as 12:00 AM, not noon", () => {
    expect(minutesToTime(1440)).toBe("12:00 AM");
  });
});

describe("minutesToDate", () => {
  it("shows 1440 as 12:00 AM on the same day, not hour 24 on the next", () => {
    const d = minutesToDate(1440);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
});

describe("interpretEndPick", () => {
  it("reads 12:00 AM as end-of-day midnight", () => {
    expect(interpretEndPick(0, 1380)).toBe(1440);
  });

  it("keeps a wrap past midnight at 1440 instead of a morning time", () => {
    expect(interpretEndPick(15, 1380)).toBe(1440);
    expect(interpretEndPick(15, 1440)).toBe(1440);
  });

  it("still lets a morning end move earlier in the morning", () => {
    expect(interpretEndPick(540, 600)).toBe(540);
  });

  it("lets an evening end move earlier in the evening", () => {
    expect(interpretEndPick(1320, 1380)).toBe(1320);
  });
});
