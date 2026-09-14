-- Hotfix: 0008_owner_key_activity.sql's `create or replace function cast_vote(...)`
-- re-defined cast_vote from scratch and, in doing so, silently dropped the
-- `#variable_conflict use_column` pragma that 0004_fix_ambiguous_vote_columns.sql
-- had added to fix exactly this bug. That regressed cast_vote back to throwing
-- "column reference \"va\" is ambiguous" (Postgres 42702) on every vote in
-- production, starting from when 0008 was applied.
--
-- Root cause (same as 0004): RETURNS TABLE(va integer, vb integer, ...)
-- declares OUT parameters named va/vb, which become PL/pgSQL variables for
-- the whole function body, shadowing the posts.va/posts.vb columns inside
-- `update posts set va = va + 1 ...`. `#variable_conflict use_column` tells
-- PL/pgSQL to prefer the column on a bare-name conflict.
--
-- This migration re-applies that pragma while keeping 0008's owner_key_hash
-- backfill logic intact. add_reaction is untouched -- it returns jsonb (no
-- named OUT params), so it was never affected by this bug and does not need
-- the pragma.

create or replace function cast_vote(p_post_id text, p_voter_id text, p_side text, p_owner_key_hash text default null)
returns table(va integer, vb integer, already_voted boolean)
language plpgsql
as $$
#variable_conflict use_column
declare
  v_rows integer;
begin
  insert into votes(post_id, voter_id, side, owner_key_hash) values (p_post_id, p_voter_id, p_side, p_owner_key_hash)
  on conflict (post_id, voter_id) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    if p_side = 'a' then
      update posts set va = va + 1 where id = p_post_id;
    else
      update posts set vb = vb + 1 where id = p_post_id;
    end if;
  elsif p_owner_key_hash is not null then
    update votes set owner_key_hash = p_owner_key_hash
      where post_id = p_post_id and voter_id = p_voter_id and owner_key_hash is null;
  end if;

  return query select p.va, p.vb, (v_rows = 0) from posts p where p.id = p_post_id;
end;
$$;
