# Deploying The Unsaid

This is the Next.js + Supabase + Razorpay rebuild of `unsaid-v30.html`, per the
"pending work to launch" plan. Everything in this file is the part that needs
you specifically — your identity, your accounts, your card. Nothing here can
be done by an agent on your behalf.

## 1. Accounts to create (in this order — merchant KYC gates everything else)

1. **Cashfree** (cashfree.com/merchants) — Payments gateway. Once approved, go to
   **Payment Gateway -> Developers -> API Keys** for `CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY`
   and set `CASHFREE_ENV=production`.
2. **Supabase** (supabase.com) — free tier is fine to start. Create a
   project, then in the SQL editor run migrations. Then go to **Project Settings -> API** for `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (the
   service role key is secret — never put it in a client-side file).
3. **Vercel** (vercel.com) — connect this repo (push it to a GitHub repo
   under your account first), import it as a project.
4. Generate two secrets locally and save them somewhere: `openssl rand -hex 32`
   — one is `OWNER_KEY_SECRET`, the other `ADMIN_SESSION_SECRET`. Pick an
   `ADMIN_PASSWORD` too.

Copy `.env.example` to `.env.local` for local testing, and set the same
variable names in **Vercel -> Project Settings -> Environment Variables**
for production.

## 2. Wire up the Cashfree webhook

In the Cashfree dashboard: **Developers -> Webhooks -> Add Webhook**.
- URL: `https://www.anonverdict.com/api/cashfree/webhook`
- Event: Payment Success Webhook (`PAYMENT_SUCCESS_WEBHOOK`)
- API Version: `2025-01-01`
- No separate webhook secret needed: Cashfree signs webhooks with your `CASHFREE_SECRET_KEY`.

A post flips from `pending_payment` to `live` immediately upon verification via
`POST /api/posts/[id]/confirm`, with the webhook serving as the authoritative backup.

3. **Apple Pay / International**: Can be requested from Cashfree support after KYC approval. No code changes needed.


## 3. Deploy

```bash
# from this directory
git init   # if you haven't already
git add .
git commit -m "Initial Next.js port of The Unsaid"
```
Push to a GitHub repo, then in Vercel: **Add New -> Project -> import that
repo**. It auto-detects Next.js. Add the environment variables from step 1
before the first deploy (or redeploy after adding them).

You'll get a free `your-project.vercel.app` URL immediately — per your call
to defer the domain purchase, launch and test on that first. Buying a custom
domain is a separate, later step in Vercel's **Domains** tab, whenever you
decide it's worth it.

## 4. Before you tell a single stranger about it

- [ ] Employer clearance — you said this is already sorted.
- [ ] Merchant KYC approved (gates real payments — test mode works without it).
- [ ] Run the whole flow yourself in test mode: post a confession, pay with
      the test card, watch it go live, vote on it from a private window,
      report it, take it down from `/admin`.
- [ ] Fill in `[CONTACT EMAIL]` and `[DATE]` in `app/terms/page.tsx`.
- [ ] Have a lawyer glance at `app/terms/page.tsx` — flag the pinned-shelf
      auction mechanic specifically (it resembles a "penny auction," which
      has drawn consumer-protection scrutiny in some markets) alongside the
      general terms review.
- [ ] Replace the AI-drafted seed content, or don't seed at all — post real
      confessions from friends first, and never present generated ones as
      genuine.
- [ ] Switch Razorpay from Test Mode to Live Mode keys, and re-test with a
      tiny real payment before announcing anything.

## What's simplified vs. the original prototype (and why)

Time went to the things the prep doc called hard blockers first: payment
gating, vote/reaction/report integrity, moderation, rate limiting, and an
admin queue — all fully wired, all server-enforced. A few purely decorative
pieces of `unsaid-v30.html` were deliberately left simpler so that work could
happen:

- **Share cards** are text + native share sheet / clipboard, not the
  original's canvas-rendered themed image (and no animated clip at all).
  Re-adding the canvas card generator (it's mostly portable as-is) is a good
  next task once the core flow is proven.
- **Hero rotation** shows the single highest-heat post instead of
  auto-rotating through dilemmas needing votes; the **ticker marquee** is a
  static shell with no scrolling content yet.
- **Pending, unpaid posts** (someone opened checkout and abandoned it) are
  never cleaned up automatically yet — worth a scheduled job that deletes
  `pending_payment` rows older than, say, 24 hours.

## What's scaffolded but needs your keys to actually do anything

- **Moderation backstop** (`lib/moderation.ts`) calls OpenAI's Moderation API
  when `OPENAI_API_KEY` is set; without it, only the ported regex filter runs
  (same as the prototype had).
- **Bot blocking** (`app/components/TurnstileWidget.tsx` + `lib/turnstile.ts`)
  shows a Cloudflare Turnstile challenge on the post form and verifies it
  server-side when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`
  are set (dash.cloudflare.com -> Turnstile -> Add site, "invisible"/managed
  widget type). Without them, posting has no bot check at all yet.
- **Rate limiting** (`lib/rateLimit.ts`) uses Upstash Redis when
  `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are set; without them
  it falls back to a per-instance in-memory limiter, which is fine for one
  low-traffic Vercel region but not a real substitute once you have volume.
- **Email** (receipts, claim codes, outbid alerts, outcome reminders) is not
  wired in yet at all — Resend is in `package.json` but no templates or send
  calls exist. This was Phase 3 in the prep doc; reasonable to defer until
  Phase 1/2 prove people will pay.
- **Analytics / error tracking / uptime alerts** (Plausible or Umami, Sentry,
  UptimeRobot) — none wired in. All free-tier, all Phase 3.

## Admin panel

`/admin` — password-protected (`ADMIN_PASSWORD`), shows the report queue,
live/pending/reported counts, and revenue by currency, with take-down /
restore buttons.
