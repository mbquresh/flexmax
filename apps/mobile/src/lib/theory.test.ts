import { describe, expect, it } from "vitest";
import { visibleTheoryLines } from "./theory";

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
