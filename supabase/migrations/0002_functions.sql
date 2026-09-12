-- Atomic vote/reaction/report operations, so two simultaneous requests can
-- never double-count or race each other (the thing that was impossible to
-- guarantee with the old client-side localStorage approach).

create or replace function cast_vote(p_post_id text, p_voter_id text, p_side text)
returns table(va integer, vb integer, already_voted boolean)
language plpgsql
as $$
declare
  v_rows integer;
begin
  insert into votes(post_id, voter_id, side) values (p_post_id, p_voter_id, p_side)
  on conflict (post_id, voter_id) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    if p_side = 'a' then
      update posts set va = va + 1 where id = p_post_id;
    else
      update posts set vb = vb + 1 where id = p_post_id;
    end if;
  end if;

  return query select p.va, p.vb, (v_rows = 0) from posts p where p.id = p_post_id;
end;
$$;

create or replace function add_reaction(p_post_id text, p_voter_id text, p_reaction_key text)
returns jsonb
language plpgsql
as $$
declare
  v_rows integer;
begin
  insert into reactions_log(post_id, voter_id, reaction_key) values (p_post_id, p_voter_id, p_reaction_key)
  on conflict (post_id, voter_id, reaction_key) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    update posts set reactions = jsonb_set(
      coalesce(reactions, '{}'::jsonb),
      array[p_reaction_key],
      to_jsonb(coalesce((reactions->>p_reaction_key)::int, 0) + 1)
    ) where id = p_post_id;
  end if;

  return (select reactions from posts where id = p_post_id);
end;
$$;

create or replace function file_report(p_post_id text, p_reporter_id text, p_reason text default null)
returns table(reports integer, hidden boolean)
language plpgsql
as $$
declare
  v_rows integer;
begin
  insert into reports_log(post_id, reporter_id, reason) values (p_post_id, p_reporter_id, p_reason)
  on conflict (post_id, reporter_id) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    update posts set reports = reports + 1 where id = p_post_id;
    update posts set hidden = true where id = p_post_id and reports >= 5;
  end if;

  return query select p.reports, p.hidden from posts p where p.id = p_post_id;
end;
$$;

-- Heartbeat upsert + presence read in one round trip.
create or replace function touch_presence(p_session_id text)
returns table(online_now integer, today_count integer)
language plpgsql
as $$
begin
  insert into presence_heartbeats(session_id, first_seen_at, last_seen_at)
  values (p_session_id, now(), now())
  on conflict (session_id) do update set last_seen_at = now();

  return query
    select
      (select count(*)::int from presence_heartbeats where last_seen_at > now() - interval '5 minutes'),
      (select count(*)::int from presence_heartbeats where first_seen_at::date = current_date);
end;
$$;
