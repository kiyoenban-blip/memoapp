import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
import { createNote, db, editNote } from "../src/lib/db";
const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  getUser: vi.fn(),
  range: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mock.getUser },
    rpc: mock.rpc,
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ range: mock.range }) }) }),
    }),
  }),
}));
vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-test-key");
const { syncNotes } = await import("../src/lib/sync");
beforeEach(async () => {
  await db.notes.clear();
  vi.clearAllMocks();
  mock.getUser.mockResolvedValue({
    data: { user: { id: "alice" } },
    error: null,
  });
  mock.range.mockResolvedValue({ data: [], error: null });
  mock.rpc.mockImplementation(async (_name, { incoming }) => ({
    data: incoming,
    error: null,
  }));
});
it("acknowledges uploaded local changes", async () => {
  const note = await createNote("alice", "hello");
  await syncNotes("alice");
  expect((await db.notes.get(note.id))?.dirty).toBe(0);
  expect(mock.rpc).toHaveBeenCalledWith(
    "merge_note",
    expect.objectContaining({
      incoming: expect.objectContaining({ user_id: "alice", body: "hello" }),
    }),
  );
});
it("keeps edits made while upload is in flight", async () => {
  const note = await createNote("alice", "old");
  mock.rpc.mockImplementation(async (_name, { incoming }) => {
    await editNote(note.id, { body: "new while syncing" });
    return { data: incoming, error: null };
  });
  await syncNotes("alice");
  expect(await db.notes.get(note.id)).toMatchObject({
    body: "new while syncing",
    dirty: 1,
  });
});
it("keeps dirty notes after a server error", async () => {
  const note = await createNote("alice", "keep me");
  mock.rpc.mockResolvedValue({ data: null, error: new Error("offline") });
  await expect(syncNotes("alice")).rejects.toThrow("offline");
  expect((await db.notes.get(note.id))?.dirty).toBe(1);
});
it("does not send notes under a different authenticated account", async () => {
  await createNote("alice", "private");
  mock.getUser.mockResolvedValue({
    data: { user: { id: "bob" } },
    error: null,
  });
  await expect(syncNotes("alice")).rejects.toThrow();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("receives remote deletion tombstones", async () => {
  const note = await createNote("alice", "content");
  await db.notes.update(note.id, { dirty: 0 });
  mock.range.mockResolvedValue({
    data: [
      {
        id: note.id,
        user_id: "alice",
        body: "content",
        pinned: false,
        deleted: true,
        created_at: note.createdAt,
        updated_at: new Date(Date.now() + 1000).toISOString(),
      },
    ],
    error: null,
  });
  await syncNotes("alice");
  expect(await db.notes.get(note.id)).toMatchObject({
    deleted: true,
    body: "content",
    dirty: 0,
  });
});

it('does not replace an in-flight local edit during the pull phase',async()=>{
 const note=await createNote('alice','old');
 mock.rpc.mockImplementation(async(_name,{incoming})=>{await editNote(note.id,{body:'typed during sync'});return {data:incoming,error:null};});
 mock.range.mockResolvedValue({data:[{id:note.id,user_id:'alice',body:'remote',pinned:false,deleted:false,created_at:note.createdAt,updated_at:new Date(Date.now()+10000).toISOString()}],error:null});
 await syncNotes('alice');
 expect(await db.notes.get(note.id)).toMatchObject({body:'typed during sync',dirty:1});
});
