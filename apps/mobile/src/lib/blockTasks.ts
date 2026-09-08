import { supabase } from "./supabase";
import { BlockTask } from "../types/database";
import { handleError } from "./errors";

type Result<T> = { data: T | null; error: unknown };

async function nextPosition(blockId: string, date: string): Promise<number> {
  const { data, error } = await supabase
    .from("block_tasks")
    .select("position")
    .eq("block_id", blockId)
    .eq("date", date)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.position ?? -1) + 1;
}

export async function listBlockTasks(
  userId: string,
  date: string
): Promise<Result<BlockTask[]>> {
  const { data, error } = await supabase
    .from("block_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) handleError(error, "listBlockTasks");
  return { data, error };
}

export async function createBlockTask(
  userId: string,
  blockId: string,
  date: string,
  name: string
): Promise<Result<BlockTask>> {
  const trimmed = name.trim();
  if (!trimmed) {
    const error = { message: "Name can't be blank" };
    handleError(error, "createBlockTask", "Name can't be blank");
    return { data: null, error };
  }
  try {
    const position = await nextPosition(blockId, date);
    const { data, error } = await supabase
      .from("block_tasks")
      .insert({
        user_id: userId,
        block_id: blockId,
        date,
        name: trimmed,
        position,
      })
      .select()
      .single();
    if (error) handleError(error, "createBlockTask", "Couldn't add the task");
    return { data, error };
  } catch (error) {
    handleError(error, "createBlockTask", "Couldn't add the task");
    return { data: null, error };
  }
}

export async function setBlockTaskDone(
  taskId: string,
  done: boolean
): Promise<Result<BlockTask>> {
  const { data, error } = await supabase
    .from("block_tasks")
    .update({ done })
    .eq("id", taskId)
    .select()
    .single();
  if (error) handleError(error, "setBlockTaskDone", "Couldn't update the task");
  return { data, error };
}

export async function renameBlockTask(
  taskId: string,
  name: string
): Promise<Result<BlockTask>> {
  const trimmed = name.trim();
  if (!trimmed) {
    const error = { message: "Name can't be blank" };
    handleError(error, "renameBlockTask", "Name can't be blank");
    return { data: null, error };
  }
  const { data, error } = await supabase
    .from("block_tasks")
    .update({ name: trimmed })
    .eq("id", taskId)
    .select()
    .single();
  if (error) handleError(error, "renameBlockTask", "Couldn't rename the task");
  return { data, error };
}

export async function moveBlockTask(
  taskId: string,
  blockId: string,
  date: string
): Promise<Result<BlockTask>> {
  try {
    const position = await nextPosition(blockId, date);
    const { data, error } = await supabase
      .from("block_tasks")
      .update({ block_id: blockId, date, position })
      .eq("id", taskId)
      .select()
      .single();
    if (error) handleError(error, "moveBlockTask", "Couldn't move the task");
    return { data, error };
  } catch (error) {
    handleError(error, "moveBlockTask", "Couldn't move the task");
    return { data: null, error };
  }
}

export async function deleteBlockTask(
  taskId: string
): Promise<Result<null>> {
  const { error } = await supabase.from("block_tasks").delete().eq("id", taskId);
  if (error) handleError(error, "deleteBlockTask", "Couldn't delete the task");
  return { data: null, error };
}
