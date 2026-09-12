-- Raise the confession/dilemma text limit from 400 to 800 characters,
-- to give posts room for a short story arc rather than a one-liner.
--
-- NOT YET APPLIED to the live database — the app-side (400) constraints in
-- app/components/PostModal.tsx and app/api/posts/route.ts already match
-- this migration's 800, but this file must be run manually in the
-- Supabase SQL editor to actually lift the database's own check constraint.
-- (Claude's session is blocked from running schema-altering SQL against
-- production directly; run this yourself in the SQL editor.)

alter table posts drop constraint posts_text_check;
alter table posts add constraint posts_text_check check (char_length(text) <= 800);
