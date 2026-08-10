import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { isTransportError } from "./errors";
import { AdhocTask, DailyInstance } from "../types/database";

const STORAGE_KEY = "write_queue";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type QueuedWrite = {
  id: string;
  table: "daily_schedule_instances" | "adhoc_tasks";
  rowId: string;
  patch: Record<string, unknown>;
  queuedAt: number;
};

let queue: QueuedWrite[] = [];
let loaded = false;
let flushInFlight = false;
const listeners = new Set<() => void>();

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

async function loadQueue(): Promise<QueuedWrite[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as QueuedWrite[];
    const cutoff = Date.now() - MAX_AGE_MS;
    return parsed.filter((entry) => entry.queuedAt > cutoff);
  } catch {
    return [];
  }
}

async function persist(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  notify();
}

async function ensureLoaded(): Promise<void> {
  if (!loaded) {
    queue = await loadQueue();
    loaded = true;
    notify();
  }
}

export async function initWriteQueue(): Promise<void> {
  await ensureLoaded();
}

export async function enqueue(
  table: QueuedWrite["table"],
  rowId: string,
  patch: Record<string, unknown>
): Promise<void> {
  await ensureLoaded();

  const existing = queue.find((entry) => entry.table === table && entry.rowId === rowId);
  if (existing) {
    existing.patch = { ...existing.patch, ...patch };
    existing.queuedAt = Date.now();
  } else {
    queue.push({
      id: uuid(),
      table,
      rowId,
      patch,
      queuedAt: Date.now(),
    });
  }

  await persist();
}

export function getPending(): QueuedWrite[] {
  return [...queue];
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function flush(): Promise<void> {
  if (flushInFlight) return;

  flushInFlight = true;
  try {
    await ensureLoaded();

    const sorted = [...queue].sort((a, b) => a.queuedAt - b.queuedAt);
    for (const entry of sorted) {
      try {
        const { error } =
          entry.table === "daily_schedule_instances"
            ? await supabase
                .from("daily_schedule_instances")
                .update(entry.patch as Partial<DailyInstance>)
                .eq("id", entry.rowId)
            : await supabase
                .from("adhoc_tasks")
                .update(entry.patch as Partial<AdhocTask>)
                .eq("id", entry.rowId);

        if (error) {
          console.error("[writeQueue] server rejected, dropping entry", entry, error);
          queue = queue.filter((item) => item.id !== entry.id);
          await persist();
          continue;
        }

        queue = queue.filter((item) => item.id !== entry.id);
        await persist();
      } catch (err) {
        if (isTransportError(err)) {
          return;
        }
        throw err;
      }
    }
  } finally {
    flushInFlight = false;
  }
}
