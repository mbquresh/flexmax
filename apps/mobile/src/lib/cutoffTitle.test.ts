import { describe, expect, it } from "vitest";
import { cutoffTitle } from "./cutoffTitle";
import { BlockTask } from "../types/database";

function task(partial: Partial<BlockTask> & Pick<BlockTask, "name" | "done">): BlockTask {
  return {
    id: partial.id ?? partial.name,
    user_id: "u",
    block_id: "b",
    date: "2026-09-08",
    position: partial.position ?? 0,
    created_at: "2026-09-08T00:00:00Z",
    ...partial,
  };
}

describe("cutoffTitle", () => {
  it("is null when every task is done", () => {
    expect(cutoffTitle([task({ name: "Chest", done: true })])).toBeNull();
  });

  it("is the first incomplete name", () => {
    expect(
      cutoffTitle([
        task({ name: "Warmup", done: true }),
        task({ name: "Chest day", done: false, position: 1 }),
      ])
    ).toBe("Chest day");
  });

  it("appends the remaining count when more than one is open", () => {
    expect(
      cutoffTitle([
        task({ name: "Chest day", done: false }),
        task({ name: "Run", done: false, position: 1 }),
      ])
    ).toBe("Chest day · 2");
  });
});
