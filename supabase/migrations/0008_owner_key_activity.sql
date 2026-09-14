-- Links votes and reactions to the poster's owner key, so "My posts" can show
-- not just what you created but what you voted on and reacted to — restorable
-- on any device the same way posts already are.
--
-- This is purely additive. The existing anti-abuse mechanism (one vote / one
-- reaction per voter_id, enforced by the unique constraints below) is
-- untouched — owner_key_hash is never used for uniqueness, only for
-- "what did this key engage with" lookups. A voter without a key yet still
-- votes/reacts exactly as before; owner_key_hash is just null on their rows
-- until the client has one to send (see cast_vote/add_reaction below).

alter table votes add column if not exists owner_key_hash text;
alter table reactions_log add column if not exists owner_key_hash text;

create index if not exists idx_votes_owner_key on votes (owner_key_hash) where owner_key_hash is not null;
create index if not exists idx_reactions_log_owner_key on reactions_log (owner_key_hash) where owner_key_hash is not null;

-- cast_vote / add_reaction: accept an optional owner_key_hash (new 4th param,
-- defaulted so any existing caller keeps working unchanged) and store it
-- alongside the vote/reaction row. If the row already existed (a re-vote
-- attempt, or a reaction logged before the client had a key), backfill the
-- key onto it rather than overwrite one that's already set — a key is set
-- once and never displaced by a different one.

create or replace function cast_vote(p_post_id text, p_voter_id text, p_side text, p_owner_key_hash text default null)
returns table(va integer, vb integer, already_voted boolean)
language plpgsql
as $$
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

create or replace function add_reaction(p_post_id text, p_voter_id text, p_reaction_key text, p_owner_key_hash text default null)
returns jsonb
language plpgsql
as $$
declare
  v_rows integer;
begin
  insert into reactions_log(post_id, voter_id, reaction_key, owner_key_hash) values (p_post_id, p_voter_id, p_reaction_key, p_owner_key_hash)
  on conflict (post_id, voter_id, reaction_key) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    update posts set reactions = jsonb_set(
      coalesce(reactions, '{}'::jsonb),
      array[p_reaction_key],
      to_jsonb(coalesce((reactions->>p_reaction_key)::int, 0) + 1)
    ) where id = p_post_id;
  elsif p_owner_key_hash is not null then
    update reactions_log set owner_key_hash = p_owner_key_hash
      where post_id = p_post_id and voter_id = p_voter_id and reaction_key = p_reaction_key and owner_key_hash is null;
  end if;

  return (select reactions from posts where id = p_post_id);
end;
$$;
