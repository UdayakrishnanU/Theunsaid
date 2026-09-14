-- Lets a retried "Pay and post" submit (after a stalled/uncertain first
-- attempt, without closing the create-post modal) reuse the same draft
-- instead of creating a second post and a second Razorpay order. The app
-- generates one key per time the modal is opened and sends it with every
-- submit attempt while that modal stays open.
--
-- NOT YET APPLIED to the live database — run this in the Supabase SQL editor
-- (Claude's session cannot run schema-altering SQL against production
-- directly).

alter table posts add column if not exists idempotency_key text;
create unique index if not exists idx_posts_idempotency_key on posts (idempotency_key) where idempotency_key is not null;
