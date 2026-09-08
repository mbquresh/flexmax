import { BlockTask } from "../types/database";

/** First incomplete task name, with a remaining count when more than one is open. */
export function cutoffTitle(tasks: BlockTask[]): string | null {
  const open = tasks.filter((t) => !t.done);
  if (!open.length) return null;
  const name = open[0].name.trim();
  if (!name) return null;
  if (open.length === 1) return name.slice(0, 60);
  const suffix = ` · ${open.length}`;
  return `${name.slice(0, Math.max(1, 60 - suffix.length))}${suffix}`;
}
