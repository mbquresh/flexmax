import { describe, expect, it } from "vitest";
import { formatDisplayDate, getLocalDateString } from "./time";
import { groupTheoryLines, theoryAsOfDate, visibleTheoryLines } from "./theory";

describe("visibleTheoryLines", () => {
  it("drops disputed lines and opens with strengths", () => {
    const rows = [
      { id: "c", kind: "causal", rank: 1, disputed_at: null },
      { id: "s", kind: "strength", rank: 3, disputed_at: null },
      { id: "p", kind: "pattern", rank: 2, disputed_at: "2026-09-05T00:00:00Z" },
    ];
    expect(visibleTheoryLines(rows).map((r) => r.id)).toEqual(["s", "c"]);
  });

  it("keeps strength order by rank among themselves", () => {
    const rows = [
      { kind: "strength", rank: 2, disputed_at: null },
      { kind: "strength", rank: 1, disputed_at: null },
    ];
    expect(visibleTheoryLines(rows).map((r) => r.rank)).toEqual([1, 2]);
  });
});

describe("groupTheoryLines", () => {
  it("opens with strengths, then check engine, and drops empty kinds", () => {
    const rows = [
      { id: "c", kind: "causal", rank: 2, disputed_at: null },
      { id: "k", kind: "structural", rank: 1, disputed_at: null },
      { id: "s", kind: "strength", rank: 3, disputed_at: null },
    ];
    expect(groupTheoryLines(rows).map((s) => s.kind)).toEqual([
      "strength",
      "structural",
      "causal",
    ]);
    expect(groupTheoryLines(rows)[1].lines.map((r) => r.id)).toEqual(["k"]);
  });

  it("keeps three pattern lines as one Worth watching section", () => {
    const rows = [
      { id: "s", kind: "strength", rank: 1, disputed_at: null },
      { id: "k", kind: "structural", rank: 2, disputed_at: null },
      { id: "p1", kind: "pattern", rank: 3, disputed_at: null },
      { id: "p2", kind: "pattern", rank: 4, disputed_at: null },
      { id: "p3", kind: "pattern", rank: 5, disputed_at: null },
    ];
    const grouped = groupTheoryLines(rows);
    expect(grouped.map((s) => s.kind)).toEqual([
      "strength",
      "structural",
      "pattern",
    ]);
    expect(grouped[2].lines.map((r) => r.id)).toEqual(["p1", "p2", "p3"]);
  });
});

describe("theoryAsOfDate", () => {
  it("formats the set's generated_at on the device calendar", () => {
    const stamp = "2026-09-08T18:00:00.000Z";
    expect(theoryAsOfDate([{ generated_at: stamp }])).toBe(
      formatDisplayDate(getLocalDateString(new Date(stamp)))
    );
  });

  it("returns null when the set has no stamp", () => {
    expect(theoryAsOfDate([])).toBeNull();
    expect(theoryAsOfDate([{ generated_at: null }])).toBeNull();
  });
});
