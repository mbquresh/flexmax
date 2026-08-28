import { DailyInstance } from "../types/database";

export type PreemptHistoryRow = { block_id: string; date: string; status: string };

export type PreemptCandidate = {
  instanceId: string;
  blockId: string;
  blockName: string;
  startMinutes: number;
  landed: number;
  total: number;
};

const WINDOW = 7;
const MIN_FAILURES = 4;

// One nudge per day, for the block with the worst recent record. A qualifying
// block already receives start, cutoff and end notifications; without this cap
// a bad week would produce one nudge per block per day, which is how people
// turn notifications off at the OS level and silently lose everything.
export function pickPreemptTarget(
  instances: DailyInstance[],
  history: PreemptHistoryRow[],
  nowMinutes: number
): PreemptCandidate | null {
  const byBlock = new Map<string, PreemptHistoryRow[]>();
  for (const row of history) {
    const list = byBlock.get(row.block_id) ?? [];
    list.push(row);
    byBlock.set(row.block_id, list);
  }

  const candidates: PreemptCandidate[] = [];

  for (const inst of instances) {
    if (!inst.block?.name || !inst.block_id) continue;
    if (inst.status !== "pending") continue;
    if (inst.start_minutes <= nowMinutes) continue;

    const rows = (byBlock.get(inst.block_id) ?? [])
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, WINDOW);

    if (rows.length < WINDOW) continue;

    const failures = rows.filter(
      (r) => r.status === "missed" || r.status === "unaccounted"
    ).length;
    if (failures < MIN_FAILURES) continue;

    candidates.push({
      instanceId: inst.id,
      blockId: inst.block_id,
      blockName: inst.block.name,
      startMinutes: inst.start_minutes,
      landed: rows.length - failures,
      total: rows.length,
    });
  }

  if (!candidates.length) return null;

  // Worst record wins; earliest start breaks a tie, because a nudge the user
  // can still act on beats one that arrives after the day is already shaped.
  candidates.sort(
    (a, b) => a.landed - b.landed || a.startMinutes - b.startMinutes
  );
  return candidates[0];
}

export function preemptBody(c: PreemptCandidate): string {
  // States what LANDED, not what failed. Same fact, and this arrives while
  // the user is deciding whether to start. Never address the user directly
  // and never use the word "you".
  return `${c.landed} of the last ${c.total} landed.`;
}
