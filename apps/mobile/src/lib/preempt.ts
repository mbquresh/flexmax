import { DailyInstance } from "../types/database";
import { minutesToTime } from "./time";

export type PreemptHistoryRow = { block_id: string; date: string; status: string };

export type CouplingRow = {
  trigger_block_id: string;
  later_block_id: string;
  relation: string;
  persistence: string;
  lift: number;
  pct_when_won: number;
  pct_when_lost: number;
  n_lost: number;
};

export type CoupledPreempt = {
  triggerName: string;
  laterName: string;
  nLost: number;
  laterFailed: number;
  pctWhenLost: number;
  lift: number;
};

export type PreemptCandidate = {
  instanceId: string;
  blockId: string;
  blockName: string;
  startMinutes: number;
  landed: number;
  total: number;
  coupled?: CoupledPreempt;
};

const WINDOW = 7;
const MIN_FAILURES = 4;

function pickCoupledTarget(
  instances: DailyInstance[],
  nowMinutes: number,
  coupling: CouplingRow[]
): PreemptCandidate | null {
  const failedTriggers = instances.filter(
    (inst) =>
      !!inst.block_id &&
      (inst.status === "missed" || inst.status === "unaccounted") &&
      inst.end_minutes <= nowMinutes
  );

  const candidates: PreemptCandidate[] = [];

  for (const trigger of failedTriggers) {
    const pairs = coupling.filter(
      (row) =>
        row.trigger_block_id === trigger.block_id &&
        row.relation === "keystone" &&
        row.persistence === "confirmed"
    );

    for (const pair of pairs) {
      const later = instances.find(
        (inst) =>
          inst.block_id === pair.later_block_id &&
          inst.status === "pending" &&
          inst.start_minutes > nowMinutes &&
          !!inst.block?.name
      );
      const laterName = later?.block?.name;
      if (!later || !later.block_id || !laterName) continue;

      // Reconstruct the later-failed count from the stored percentage.
      // The table does not keep the raw count; SQL already rounded pct.
      const laterFailed = Math.round((pair.pct_when_lost * pair.n_lost) / 100);

      candidates.push({
        instanceId: later.id,
        blockId: later.block_id,
        blockName: laterName,
        startMinutes: later.start_minutes,
        landed: pair.n_lost - laterFailed,
        total: pair.n_lost,
        coupled: {
          triggerName: trigger.block?.name ?? "That block",
          laterName,
          nLost: pair.n_lost,
          laterFailed,
          pctWhenLost: pair.pct_when_lost,
          lift: pair.lift,
        },
      });
    }
  }

  if (!candidates.length) return null;

  // Strongest keystone first (most negative lift); earliest start breaks a
  // tie so the nudge still lands while the later block can be started.
  candidates.sort(
    (a, b) =>
      (a.coupled?.lift ?? 0) - (b.coupled?.lift ?? 0) ||
      a.startMinutes - b.startMinutes
  );
  return candidates[0];
}

// One nudge per day, for the block with the worst recent record. A qualifying
// block already receives start, cutoff and end notifications; without this cap
// a bad week would produce one nudge per block per day, which is how people
// turn notifications off at the OS level and silently lose everything.
export function pickPreemptTarget(
  instances: DailyInstance[],
  history: PreemptHistoryRow[],
  nowMinutes: number,
  coupling: CouplingRow[] = []
): PreemptCandidate | null {
  const coupled = pickCoupledTarget(instances, nowMinutes, coupling);
  if (coupled) return coupled;

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

// The day's pick is chosen once at load and passed through every resync
// so a swap cannot drop it. Times move; the fire clock must follow the
// instance, not that snapshot. Cardio picked at 1:00, then swapped to
// 4:30, still firing at 1:00 is the bug this closes.
export function resolvePreempt(
  preempt: PreemptCandidate | null,
  instances: DailyInstance[],
  nowMinutes: number
): PreemptCandidate | null {
  if (!preempt) return null;
  const inst = instances.find((i) => i.id === preempt.instanceId);
  if (!inst || inst.status !== "pending") return null;
  if (inst.start_minutes <= nowMinutes) return null;
  return {
    ...preempt,
    startMinutes: inst.start_minutes,
    blockName: inst.block?.name ?? preempt.blockName,
    coupled: preempt.coupled
      ? {
          ...preempt.coupled,
          laterName: inst.block?.name ?? preempt.coupled.laterName,
        }
      : undefined,
  };
}

export function preemptTitle(c: PreemptCandidate): string {
  if (c.coupled) return `Your ${c.coupled.laterName} is at risk.`;
  return `${c.blockName} starts now`;
}

export function preemptBody(c: PreemptCandidate): string {
  if (c.coupled) {
    const time = minutesToTime(c.startMinutes);
    return `${c.coupled.triggerName} didn't happen today. On the last ${c.coupled.nLost} days that happened, ${c.coupled.laterName} didn't either — ${c.coupled.laterFailed} of them. It starts at ${time}.`;
  }
  // States what LANDED, not what failed. Same fact, and this arrives while
  // the user is deciding whether to start. Never address the user directly
  // and never use the word "you".
  return `${c.landed} of the last ${c.total} landed.`;
}
