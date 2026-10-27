create table if not exists public.notes (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 body text not null default '', pinned boolean not null default false,
 deleted boolean not null default false, created_at timestamptz not null,
 updated_at timestamptz not null
);
create index if not exists notes_user_id_idx on public.notes(user_id);
alter table public.notes enable row level security;
drop policy if exists "Own notes" on public.notes;
create policy "Own notes" on public.notes for all to authenticated
 using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Atomic last-write-wins. The client never overwrites a newer server version.
create or replace function public.merge_note(incoming jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare result public.notes;
begin
 if auth.uid() is null or (incoming->>'user_id')::uuid <> auth.uid() then
  raise exception 'Unauthorized';
 end if;
 insert into public.notes as n(id,user_id,body,pinned,deleted,created_at,updated_at)
 values ((incoming->>'id')::uuid,auth.uid(),incoming->>'body',(incoming->>'pinned')::boolean,
 (incoming->>'deleted')::boolean,(incoming->>'created_at')::timestamptz,(incoming->>'updated_at')::timestamptz)
 on conflict(id) do update set body=excluded.body,pinned=excluded.pinned,
 deleted=excluded.deleted,updated_at=excluded.updated_at
 where n.user_id=auth.uid() and excluded.updated_at>n.updated_at;
 select * into result from public.notes where id=(incoming->>'id')::uuid and user_id=auth.uid();
 return to_jsonb(result);
end $$;
revoke all on function public.merge_note(jsonb) from public, anon;
grant execute on function public.merge_note(jsonb) to authenticated;
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='notes' and schemaname='public') then
 alter publication supabase_realtime add table public.notes;
 end if;
end $$;
-- Explicit privileges for API access; RLS still restricts each row to its owner.
revoke all on public.notes from anon;
grant select, insert, update on public.notes to authenticated;
