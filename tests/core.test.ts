import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createNote, db, editNote, title } from "../src/lib/db";
import { progress, toggleTask } from "../src/lib/markdown";
beforeEach(async () => {
  await db.notes.clear();
});
describe("local notes", () => {
  it("persists edits and deletion/restoration without losing content", async () => {
    const n = await createNote("local", "# 기록");
    await editNote(n.id, { body: "# 변경", pinned: true });
    await editNote(n.id, { deleted: true });
    await editNote(n.id, { deleted: false });
    const saved = await db.notes.get(n.id);
    expect(saved).toMatchObject({
      body: "# 변경",
      pinned: true,
      deleted: false,
      dirty: 1,
    });
    expect(saved!.updatedAt > n.updatedAt).toBe(true);
  });
  it("isolates accounts and local notes", async () => {
    await createNote("local", "local");
    await createNote("alice", "private");
    await createNote("bob", "other");
    expect(
      (await db.notes.where("owner").equals("alice").toArray()).map(
        (n) => n.body,
      ),
    ).toEqual(["private"]);
  });
  it("extracts title", () => {
    expect(title("\n# 첫 메모\n내용")).toBe("첫 메모");
    expect(title("")).toBe("제목 없는 메모");
  });
});
describe("markdown tasks", () => {
  it("toggles only real tasks, preserving fenced code", () => {
    const body =
      "# 할 일\n\n```md\n- [ ] code\n```\n\n- [ ] first\n- [x] second\n";
    expect(progress(body)).toEqual({ total: 2, done: 1 });
    expect(toggleTask(body, 0)).toContain("- [x] first");
    expect(toggleTask(body, 0)).toContain("- [ ] code");
    expect(toggleTask(body, 1)).toContain("- [ ] second");
  });
});

it("handles nested and quoted task locations", () => {
  const body = "- [ ] parent\n  - [ ] child\n- [ ] last\n\n> - [ ] quote\n";
  expect(progress(body)).toEqual({ total: 4, done: 0 });
  expect(toggleTask(body, 1)).toContain("  - [x] child");
  expect(toggleTask(body, 3)).toContain("> - [x] quote");
});

it('reuses the startup note and excludes trashed and other-account notes',async()=>{
 const {resumeNote}=await import('../src/lib/db');
 const [first,second]=await Promise.all([resumeNote('local'),resumeNote('local')]);
 expect(first.id).toBe(second.id);
 await editNote(first.id,{body:'retained startup note'});
 expect((await resumeNote('local')).body).toBe('retained startup note');
 await createNote('alice','private');await editNote(first.id,{deleted:true});
 const next=await resumeNote('local');expect(next.id).not.toBe(first.id);expect(next.owner).toBe('local');expect(next.body).toBe('');
});

it('copies local notes to one account once without removing originals',async()=>{
 const {copyLocalNotes}=await import('../src/lib/db');
 await db.imports.clear();
 const original=await createNote('local','PC에 있던 메모');
 const deleted=await createNote('local','휴지통');await editNote(deleted.id,{deleted:true});
 expect(await copyLocalNotes('alice')).toBe(1);
 expect(await copyLocalNotes('alice')).toBe(0);
 expect(await db.notes.get(original.id)).toMatchObject({owner:'local',body:'PC에 있던 메모'});
 const copies=await db.notes.where('owner').equals('alice').toArray();
 expect(copies).toHaveLength(1);expect(copies[0]).toMatchObject({body:'PC에 있던 메모',dirty:1});expect(copies[0].id).not.toBe(original.id);
 expect(await copyLocalNotes('bob')).toBe(1);
 await expect(copyLocalNotes('local')).rejects.toThrow();
});
