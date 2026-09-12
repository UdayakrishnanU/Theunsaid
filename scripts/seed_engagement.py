#!/usr/bin/env python3
"""
One-time engagement seed for AnonVerdict's existing posts.

Gives every live post a realistic-looking vote count (dilemmas) and a
handful of emoji reactions (all posts), scaled a bit by how long the post
has been up and whether it's std/glow/pin tier. Deterministic per post id
(seeded RNG) so re-running it is idempotent-ish and reviewable.

Run this from your own terminal (not a sandboxed shell) — same reason as
scripts/inject_seed.py: this network path to supabase.co is blocked from
Claude's sandboxes.

    cd ~/Documents/the-unsaid
    python3 scripts/seed_engagement.py
"""
import json
import random
import re
import urllib.request
import urllib.error
import sys
import os
import time
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(HERE)

with open(os.path.join(REPO_ROOT, ".env.local")) as f:
    env = f.read()

url_match = re.search(r"NEXT_PUBLIC_SUPABASE_URL=(.+)", env)
key_match = re.search(r"SUPABASE_SERVICE_ROLE_KEY=(.+)", env)
if not url_match or not key_match:
    sys.exit("Could not find NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local")

url = url_match.group(1).strip()
key = key_match.group(1).strip()
base = url.rstrip("/") + "/rest/v1"
headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
}

REACTION_KEYS = ["serious", "same", "redflag", "nailed", "inspo", "thought", "cant", "goforit"]
TIER_MULT = {"std": 1.0, "glow": 2.0, "pin": 3.0}


def fetch_posts():
    req_url = base + "/posts?select=id,type,category,tier,created_at,va,vb,reactions&status=eq.live&order=created_at.asc&limit=1000"
    req = urllib.request.Request(req_url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def days_since(created_at_iso):
    try:
        dt = datetime.fromisoformat(created_at_iso.replace("Z", "+00:00"))
    except ValueError:
        return 1
    delta = datetime.now(timezone.utc) - dt
    return max(0.5, delta.total_seconds() / 86400)


def compute_votes(rng, tier, age_days):
    mult = TIER_MULT.get(tier, 1.0)
    scale = min(age_days, 10)
    base_total = rng.randint(30, 150) * scale
    total = int(base_total * mult)
    total = max(20, min(total, 6000))

    if rng.random() < 0.4:
        # close, tie-break-worthy split
        pa = rng.uniform(0.45, 0.55)
    else:
        pa = rng.uniform(0.12, 0.88)

    va = round(total * pa)
    vb = total - va
    return max(va, 0), max(vb, 0)


def compute_reactions(rng, tier, age_days):
    mult = TIER_MULT.get(tier, 1.0)
    scale = min(age_days, 10)
    n_keys = rng.randint(2, 5)
    keys = rng.sample(REACTION_KEYS, n_keys)
    out = {}
    for k in keys:
        base_r = rng.randint(8, 220) * mult * scale / 6
        out[k] = max(1, int(base_r * rng.uniform(0.4, 1.4)))
    return out


def main():
    print("Fetching live posts ...")
    posts = fetch_posts()
    print(f"Got {len(posts)} posts.")

    ok, fail = 0, 0
    t0 = time.time()
    for i, row in enumerate(posts):
        pid = row["id"]
        rng = random.Random(pid)  # deterministic per post
        age = days_since(row.get("created_at") or "")
        tier = row.get("tier") or "std"

        patch = {"reactions": compute_reactions(rng, tier, age)}
        if row.get("type") == "dilemma":
            va, vb = compute_votes(rng, tier, age)
            patch["va"] = va
            patch["vb"] = vb

        req_url = base + f"/posts?id=eq.{pid}"
        req = urllib.request.Request(
            req_url,
            data=json.dumps(patch).encode(),
            headers={**headers, "Prefer": "return=minimal"},
            method="PATCH",
        )
        try:
            with urllib.request.urlopen(req, timeout=20):
                ok += 1
        except urllib.error.HTTPError as e:
            fail += 1
            print(f"  {pid}: ERROR {e.code} {e.read()[:200]}")

        if (i + 1) % 50 == 0:
            print(f"  ... {i + 1}/{len(posts)} ({time.time() - t0:.0f}s elapsed)")

    print(f"\nDone. updated={ok} failed={fail} total={len(posts)}")


if __name__ == "__main__":
    main()
