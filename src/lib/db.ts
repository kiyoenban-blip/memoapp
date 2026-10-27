import Dexie, { type Table } from "dexie";
export interface Note {
  id: string;
  owner: string;
  body: string;
  pinned: boolean;
  deleted: boolean;
  updatedAt: string;
  createdAt: string;
  dirty: number;
}
class NotesDB extends Dexie {
  notes!: Table<Note, string>;
  imports!: Table<{owner:string;source:string;target:string},[string,string]>;
  constructor() {
    super("quicknote");
    this.version(1).stores({ notes: "id, owner, [owner+dirty]" });
    this.version(2).stores({ notes: "id, owner, [owner+dirty]", imports: "[owner+source]" });
  }
}
export const db = new NotesDB();
export const LOCAL = "local";
export function timestamp(previous?: string) {
  return new Date(
    Math.max(Date.now(), previous ? Date.parse(previous) + 1 : 0),
  ).toISOString();
}
export async function createNote(owner: string, body = "") {
  const now = timestamp();
  const note: Note = {
    id: crypto.randomUUID(),
    owner,
    body,
    pinned: false,
    deleted: false,
    createdAt: now,
    updatedAt: now,
    dirty: 1,
  };
  await db.notes.add(note);
  return note;
}
export async function editNote(
  id: string,
  changes: Partial<Pick<Note, "body" | "pinned" | "deleted">>,
) {
  await db.transaction("rw", db.notes, async () => {
    const note = await db.notes.get(id);
    if (note)
      await db.notes.update(id, {
        ...changes,
        updatedAt: timestamp(note.updatedAt),
        dirty: 1,
      });
  });
}
export function title(body: string) {
  return (
    body
      .split("\n")
      .find((x) => x.trim())
      ?.replace(/^\s{0,3}#{1,6}\s+/, "")
      .trim()
      .slice(0, 100) || "제목 없는 메모"
  );
}

export function rememberNote(note: Note) {
  if (note.deleted) return;
  try { localStorage.setItem(`quicknote-last-${note.owner}`, note.id); } catch { /* Optional preference. */ }
}

// A transaction prevents two simultaneous startup windows from creating duplicates.
export async function resumeNote(owner: string): Promise<Note> {
  let previous: string | null = null;
  try { previous = localStorage.getItem(`quicknote-last-${owner}`); } catch { /* Fall back to newest. */ }
  return db.transaction('rw', db.notes, async () => {
    const notes = (await db.notes.where('owner').equals(owner).toArray()).filter(n => !n.deleted);
    const note = notes.find(n => n.id === previous) ?? notes.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
    return note ?? createNote(owner);
  });
}

// Copy on explicit request only. Keep device originals and a durable import map.
export async function copyLocalNotes(owner: string): Promise<number> {
  if (!owner || owner === LOCAL) throw new Error('먼저 로그인해 주세요.');
  return db.transaction('rw', db.notes, db.imports, async () => {
    const local = (await db.notes.where('owner').equals(LOCAL).toArray()).filter(n => !n.deleted);
    let count = 0;
    for (const note of local) {
      if (await db.imports.get([owner, note.id])) continue;
      const now = timestamp();
      const target = crypto.randomUUID();
      await db.notes.add({...note, id:target, owner, updatedAt:now, dirty:1});
      await db.imports.add({owner,source:note.id,target});
      count++;
    }
    return count;
  });
}
