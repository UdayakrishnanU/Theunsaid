-- Previously, file_report() auto-hid a post the instant it hit 5 reports —
-- with no notice to the owner and no way to appeal, and since the report
-- "identity" is just a cookie, 5 clicks from one person cycling sessions was
-- enough to take a post down. Reports still accumulate exactly as before and
-- still surface the post in the admin report queue (app/admin, anything with
-- reports > 0) — a human now decides whether to actually take it down (via
-- the existing hide/unhide button there), instead of the raw report count
-- doing it automatically.
--
-- NOT YET APPLIED to the live database — run this in the Supabase SQL editor
-- (Claude's session cannot run schema/function-altering SQL against
-- production directly).

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
  end if;

  return query select p.reports, p.hidden from posts p where p.id = p_post_id;
end;
$$;
