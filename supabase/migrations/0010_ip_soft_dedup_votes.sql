-- IP-based soft dedup for votes.
--
-- Why: the existing anti-abuse mechanism (unique(post_id, voter_id), where
-- voter_id lives in the httpOnly unsaid_voter cookie -- see lib/identity.ts)
-- treats each *browser* as a separate voter. Safari, Arc and Chrome on the
-- same phone each keep their own cookie jar, so the same person switching
-- between them gets three fresh voter_ids and three counted votes on the
-- same post.
--
-- This adds a second, IP-scoped guard on top, without replacing the first:
-- the first vote from a given (post, ip_hash) pair counts toward va/vb as
-- before. A later vote on that post from a *different* voter_id but the
-- *same* ip_hash is still inserted -- so that browser still shows "you
-- voted" and its side is recorded -- but does not move the tally a second
-- time.
--
-- Deliberately "soft" (an application-level check, not a unique constraint
-- that would reject the insert): a raw client IP is not a person. Carrier
-- NAT on Indian mobile networks (Jio, Airtel, etc.) routinely puts many
-- unrelated real users behind one public IP, and a hard per-IP cap would
-- silently block genuine distinct voters. This only removes the double
-- count from the *same person's* second browser -- it never errors, and it
-- never prevents a vote from being cast.
--
-- ip_hash is an HMAC (lib/ipHash.ts), never the raw address.

alter table votes add column if not exists ip_hash text;
create index if not exists idx_votes_post_ip on votes (post_id, ip_hash) where ip_hash is not null;

-- Re-creates cast_vote with a 5th, defaulted p_ip_hash param (so any old
-- caller keeps working unchanged) and the soft-dedup check. Keeps the
-- #variable_conflict use_column pragma from 0009 -- RETURNS TABLE(va, vb,
-- ...) shadows posts.va/posts.vb inside this function, and losing that
-- pragma previously broke every vote in production (see 0009's own notes).
create or replace function cast_vote(
  p_post_id text,
  p_voter_id text,
  p_side text,
  p_owner_key_hash text default null,
  p_ip_hash text default null
)
returns table(va integer, vb integer, already_voted boolean)
language plpgsql
as $$
#variable_conflict use_column
declare
  v_rows integer;
  v_ip_already_counted boolean := false;
begin
  insert into votes(post_id, voter_id, side, owner_key_hash, ip_hash)
    values (p_post_id, p_voter_id, p_side, p_owner_key_hash, p_ip_hash)
  on conflict (post_id, voter_id) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    -- New voter_id for this post. If this IP already has a *different*
    -- voter_id's vote on it, this one is a same-person-different-browser
    -- repeat -- record it, but don't count it again.
    if p_ip_hash is not null then
      select exists(
        select 1 from votes
        where post_id = p_post_id and ip_hash = p_ip_hash and voter_id <> p_voter_id
      ) into v_ip_already_counted;
    end if;

    if not v_ip_already_counted then
      if p_side = 'a' then
        update posts set va = va + 1 where id = p_post_id;
      else
        update posts set vb = vb + 1 where id = p_post_id;
      end if;
    end if;
  elsif p_owner_key_hash is not null then
    update votes set owner_key_hash = p_owner_key_hash
      where post_id = p_post_id and voter_id = p_voter_id and owner_key_hash is null;
  end if;

  return query select p.va, p.vb, (v_rows = 0) from posts p where p.id = p_post_id;
end;
$$;
