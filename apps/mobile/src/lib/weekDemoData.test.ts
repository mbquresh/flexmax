import { describe, expect, it } from "vitest";
import {
  AFTERNOON_INDEX,
  DEMO_DAYS,
  demoCounts,
  landed,
} from "./weekDemoData";

describe("DEMO_DAYS", () => {
  it("encodes the measured 30-day coupling pair", () => {
    expect(DEMO_DAYS).toHaveLength(26);

    const morningLanded = DEMO_DAYS.filter(landed);
    const morningFailed = DEMO_DAYS.filter((d) => !landed(d));
    expect(morningLanded).toHaveLength(11);
    expect(morningFailed).toHaveLength(15);

    const failedWhenHeld = morningLanded.filter(
      (d) => d.o[AFTERNOON_INDEX] === 0
    );
    const failedWhenMissed = morningFailed.filter(
      (d) => d.o[AFTERNOON_INDEX] === 0
    );
    expect(failedWhenHeld).toHaveLength(1);
    expect(failedWhenMissed).toHaveLength(10);
  });

  it("matches the quoted readouts on each filter", () => {
    expect(demoCounts("all")).toEqual({ n: 26, missed: 11 });
    expect(demoCounts("landed")).toEqual({ n: 11, missed: 1 });
    expect(demoCounts("failed")).toEqual({ n: 15, missed: 10 });
  });
});
