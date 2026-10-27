import { createClient } from "@supabase/supabase-js";
import { db, type Note } from "./db";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
type Remote = {
  id: string;
  user_id: string;
  body: string;
  pinned: boolean;
  deleted: boolean;
  updated_at: string;
  created_at: string;
};
const fromRemote = (r: Remote): Note => ({
  id: r.id,
  owner: r.user_id,
  body: r.body,
  pinned: r.pinned,
  deleted: r.deleted,
  updatedAt: r.updated_at,
  createdAt: r.created_at,
  dirty: 0,
});
const remote = (n: Note): Remote => ({
  id: n.id,
  user_id: n.owner,
  body: n.body,
  pinned: n.pinned,
  deleted: n.deleted,
  updated_at: n.updatedAt,
  created_at: n.createdAt,
});
const running = new Map<string,Promise<void>>();
export function syncNotes(owner: string) {
  if (!supabase || owner === "local") return Promise.resolve();
  const existing=running.get(owner);
  if(existing)return existing;
  const task=perform(owner).finally(()=>running.delete(owner));
  running.set(owner,task);
  return task;
}
async function perform(owner: string) {
  const client = supabase!;
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || user?.id !== owner)
    throw new Error("로그인을 다시 확인해 주세요.");
  const pending = await db.notes
    .where("[owner+dirty]")
    .equals([owner, 1])
    .toArray();
  for (const note of pending) {
    const { data, error } = await client.rpc("merge_note", {
      incoming: remote(note),
    });
    if (error) throw error;
    const merged = fromRemote(data as Remote);
    await db.transaction("rw", db.notes, async () => {
      const current = await db.notes.get(note.id);
      if (current?.owner === owner && current.updatedAt === note.updatedAt)
        await db.notes.put(merged);
    });
  }
  // Page through all records, including deletion tombstones.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from("notes")
      .select("*")
      .eq("user_id", owner)
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    await db.transaction("rw", db.notes, async () => {
      for (const row of data as Remote[]) {
        const n = fromRemote(row);
        const local = await db.notes.get(n.id);
        if (
          !local ||
          (local.owner === owner && local.dirty === 0 &&
            Date.parse(n.updatedAt) > Date.parse(local.updatedAt))
        )
          await db.notes.put(n);
      }
    });
    if (data.length < 500) break;
  }
}
