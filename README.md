# The Unsaid

Next.js + Supabase + Razorpay rebuild of `unsaid-v30.html` — an anonymous
confession/dilemma board with paid posting tiers and an uncapped pinned-shelf
bidding auction.

Start with **DEPLOY.md** — it has the account setup, environment variables,
and the exact order to do things in (merchant KYC first, it gates everything
else). `.env.example` lists every variable and where it comes from.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in at least the Supabase + Razorpay + secret values
npm run dev
```

Run the two files in `supabase/migrations/` (in order) against your Supabase
project's SQL editor before the app will have anywhere to read/write posts.

## Structure

- `app/` — pages (board, rules, terms, about, my posts, admin) and API routes
  under `app/api/`.
- `lib/` — currency, moderation, rate limiting, Supabase client, owner-key
  hashing, Razorpay order/webhook helpers — all server-safe, framework-free.
- `app/components/` — the ported board UI (cards, modals, vote flow).
- `app/hooks/` — client-side localStorage-backed state (device owner key,
  currency choice, "have I voted on this" bookkeeping).
- `supabase/migrations/` — the schema and the Postgres functions that make
  votes/reactions/reports atomic and abuse-resistant.

## What this is not (yet)

See the bottom of `DEPLOY.md` for the honest list of what's simplified
compared to the original single-file prototype (share-card images, hero
rotation, the ticker) and what's scaffolded but inert until you add API keys
(OpenAI moderation, Upstash rate limiting, Resend email, analytics/error
tracking/uptime).
