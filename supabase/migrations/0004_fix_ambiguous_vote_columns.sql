-- Fixes "column reference \"va\"/\"vb\"/\"reports\" is ambiguous" thrown by
-- cast_vote() and file_report() when the app tries to cast a vote or file a
-- report.
--
-- Root cause: cast_vote's RETURNS TABLE(va integer, vb integer, ...) and
-- file_report's RETURNS TABLE(reports integer, ...) declare OUT parameters
-- named va/vb/reports. Inside PL/pgSQL those names become local variables
-- for the whole function body -- including inside
--   update posts set va = va + 1 where id = p_post_id;
-- The left-hand `va` is fine (it must be a column), but the right-hand `va`
-- matches BOTH the `posts.va` column and the OUT-parameter variable, so
-- Postgres can't tell which one you mean and throws "ambiguous". The final
-- `return query select p.va, p.vb, ...` line looked correct because it's
-- qualified with the `p` alias -- but the earlier UPDATE was never
-- qualified, and that's the one actually firing on every vote.
--
-- Fix: `#variable_conflict use_column` tells PL/pgSQL "when a bare name
-- could mean either a variable or a column, prefer the column" -- which is
-- what every line in these functions already assumes. No column, table, or
-- API contract changes; existing callers (the Next.js routes) don't change
-- at all.

create or replace function cast_vote(p_post_id text, p_voter_id text, p_side text)
returns table(va integer, vb integer, already_voted boolean)
language plpgsql
as $$
#variable_conflict use_column
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

create or replace function file_report(p_post_id text, p_reporter_id text, p_reason text default null)
returns table(reports integer, hidden boolean)
language plpgsql
as $$
#variable_conflict use_column
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
