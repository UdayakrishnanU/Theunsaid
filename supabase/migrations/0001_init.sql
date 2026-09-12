-- The Unsaid — initial schema.
-- Replaces window.storage/localStorage as the source of truth (prep doc Phase 1).
--
-- Design notes:
--  * All access goes through Next.js API routes using the Supabase *service role*
--    key (see lib/supabase.ts -> supabaseAdmin()). Row Level Security is enabled
--    on every table with NO policies, which means the anon/public key can read
--    or write NOTHING here — only server code with the service role key can.
--    Run this whole file once in the Supabase SQL editor (or via `supabase db push`).
--  * `posts.owner_key_hash` is an HMAC of the user's bearer "key" (see
--    lib/ownerKey.ts) — we never store the raw key.
--  * `paid_base` is a currency-normalised integer (see lib/currency.ts toBase())
--    used only to rank pinned-shelf bids against each other across currencies.

create extension if not exists pgcrypto;

create table if not exists posts (
  id                 text primary key,
  type               text not null check (type in ('confession','dilemma')),
  category           text not null check (category in ('relationships','work','money','family','random')),
  text               text not null check (char_length(text) <= 400),
  option_a           text check (char_length(option_a) <= 22),
  option_b           text check (char_length(option_b) <= 22),
  bg                 text not null default 'plain',
  tier               text not null default 'std' check (tier in ('std','glow','pin')),
  status             text not null default 'pending_payment' check (status in ('pending_payment','live','hidden','deleted')),
  owner_key_hash     text not null,
  currency           text not null,
  paid_amount_minor  integer,           -- what was actually charged, in that currency's minor unit
  paid_base          integer,           -- normalised cross-currency ranking unit (see lib/currency.ts)
  until              timestamptz,       -- glow/pin expiry (24h from going live)
  va                 integer not null default 0,
  vb                 integer not null default 0,
  reactions          jsonb not null default '{}'::jsonb,
  reports            integer not null default 0,
  hidden             boolean not null default false,
  deleted_by_author  boolean not null default false,
  outcome            jsonb,
  ip_hash            text,              -- sha256(ip + salt), kept for legal/abuse purposes only, never shown
  created_at         timestamptz not null default now(),
  paid_at            timestamptz
);
create index if not exists idx_posts_status on posts (status, hidden);
create index if not exists idx_posts_shelf on posts (tier, until) where tier = 'pin';
create index if not exists idx_posts_category on posts (category);
create index if not exists idx_posts_created on posts (created_at desc);

create table if not exists payment_orders (
  id                   text primary key,   -- razorpay order id
  post_id              text not null references posts(id) on delete cascade,
  amount_minor         integer not null,
  currency             text not null,
  status               text not null default 'created' check (status in ('created','paid','failed')),
  razorpay_payment_id  text,
  created_at           timestamptz not null default now(),
  paid_at              timestamptz
);

create table if not exists votes (
  id         bigserial primary key,
  post_id    text not null references posts(id) on delete cascade,
  voter_id   text not null,
  side       text not null check (side in ('a','b')),
  created_at timestamptz not null default now(),
  unique (post_id, voter_id)
);

create table if not exists reactions_log (
  id            bigserial primary key,
  post_id       text not null references posts(id) on delete cascade,
  voter_id      text not null,
  reaction_key  text not null,
  created_at    timestamptz not null default now(),
  unique (post_id, voter_id, reaction_key)
);

create table if not exists reports_log (
  id          bigserial primary key,
  post_id     text not null references posts(id) on delete cascade,
  reporter_id text not null,
  reason      text,
  created_at  timestamptz not null default now(),
  unique (post_id, reporter_id)
);

create table if not exists presence_heartbeats (
  session_id     text primary key,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);
create index if not exists idx_presence_last_seen on presence_heartbeats (last_seen_at);
create index if not exists idx_presence_first_seen on presence_heartbeats (first_seen_at);

-- Lock every table down to the service role only (used server-side). The
-- anon/public API key gets no access at all — the app never uses it for
-- direct table access, only Next.js API routes with the service role key do.
alter table posts enable row level security;
alter table payment_orders enable row level security;
alter table votes enable row level security;
alter table reactions_log enable row level security;
alter table reports_log enable row level security;
alter table presence_heartbeats enable row level security;
