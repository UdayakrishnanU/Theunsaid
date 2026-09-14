#!/usr/bin/env python3
"""
Build scripts/seed_v2_days.json for the 30-day incremental seed injector.

Reads the raw 10,500-row dataset (all_posts.json, already chronologically
bucketed into 30 contiguous 350-row days) and turns each row into a
DB-row-shaped object matching the `posts` table, EXCEPT for created_at,
paid_at and until — those depend on real wall-clock time and are filled in
by the cron endpoint at the moment each day's batch is actually inserted,
not baked in here.

Fixes applied:
  - option_a / option_b truncated to <=22 chars (DB CHECK constraint),
    preferring a word boundary; the useless `views` field is dropped.
  - id, owner_key_hash are freshly generated (synthetic, unclaimable).
  - pricing (paid_amount_minor / paid_base) set from lib/currency.ts's
    INR post/glow prices (std=7900, glow=29900) or the row's own
    bid_amount_inr for pin (already 499-2999, matches CUR.INR.pin floor).
  - va/vb/reactions randomized with tier priority (pin > glow > std),
    confessions get va=vb=0 (no options to vote on) but do get reactions.

Output: 30 arrays of 350 rows each, written to scripts/seed_v2_days.json.
"""
import json
import random
import secrets

random.seed(20260914)  # reproducible

import os
SRC = os.path.expanduser("~/mnt/Downloads/New folder/all_posts.json")
OUT = "seed_v2_days.json"

STD_PRICE_MINOR = 7900   # CUR.INR.post = 79
GLOW_PRICE_MINOR = 29900  # CUR.INR.glow = 299

REACTION_KEYS = ["serious", "same", "redflag", "nailed", "inspo", "thought", "cant", "goforit"]


def truncate_option(s, limit=22):
    if s is None or len(s) <= limit:
        return s
    cut = s[:limit]
    sp = cut.rfind(" ")
    if sp >= 10:
        cut = cut[:sp]
    return cut.rstrip()


def gen_id():
    return "p" + secrets.token_hex(8)


def gen_owner_hash():
    return secrets.token_hex(32)


def gen_engagement(tier, post_type):
    if tier == "pin":
        total_votes = random.randint(60, 260)
        n_reactions = random.randint(2, 5)
        react_scale = (5, 40)
    elif tier == "glow":
        total_votes = random.randint(20, 130)
        n_reactions = random.randint(1, 4)
        react_scale = (2, 20)
    else:
        total_votes = random.randint(0, 45)
        n_reactions = random.randint(0, 3)
        react_scale = (0, 12)

    if post_type == "dilemma":
        split = random.uniform(0.25, 0.75)
        va = round(total_votes * split)
        vb = total_votes - va
    else:
        va = 0
        vb = 0

    reactions = {}
    if n_reactions > 0:
        keys = random.sample(REACTION_KEYS, k=min(n_reactions, len(REACTION_KEYS)))
        for k in keys:
            c = random.randint(*react_scale)
            if c > 0:
                reactions[k] = c

    return va, vb, reactions


def transform(row):
    tier = row["tier"]
    ptype = row["type"]

    option_a = truncate_option(row.get("option_a"))
    option_b = truncate_option(row.get("option_b"))

    if tier == "pin":
        bid = row.get("bid_amount_inr") or 499
        paid_amount_minor = int(round(bid * 100))
    elif tier == "glow":
        paid_amount_minor = GLOW_PRICE_MINOR
    else:
        paid_amount_minor = STD_PRICE_MINOR

    va, vb, reactions = gen_engagement(tier, ptype)

    return {
        "id": gen_id(),
        "type": ptype,
        "category": row["category"],
        "text": row["text"],
        "option_a": option_a,
        "option_b": option_b,
        "bg": row["bg"],
        "tier": tier,
        "status": "live",
        "owner_key_hash": gen_owner_hash(),
        "currency": "INR",
        "paid_amount_minor": paid_amount_minor,
        "paid_base": paid_amount_minor,
        "va": va,
        "vb": vb,
        "reactions": reactions,
        "reports": 0,
        "hidden": False,
        "deleted_by_author": False,
        "outcome": None,
        "ip_hash": None,
    }


def main():
    with open(SRC) as f:
        rows = json.load(f)
    assert len(rows) == 10500, f"expected 10500 rows, got {len(rows)}"

    days = []
    over_limit_fixed = 0
    for d in range(30):
        chunk = rows[d * 350:(d + 1) * 350]
        out_chunk = []
        for r in chunk:
            oa, ob = r.get("option_a"), r.get("option_b")
            if (oa and len(oa) > 22) or (ob and len(ob) > 22):
                over_limit_fixed += 1
            out_chunk.append(transform(r))
        days.append(out_chunk)

    with open(OUT, "w") as f:
        json.dump(days, f, ensure_ascii=False)

    print(f"days: {len(days)}, rows/day: {[len(d) for d in days][:3]}... total: {sum(len(d) for d in days)}")
    print(f"option strings truncated: {over_limit_fixed}")
    bad = 0
    for day in days:
        for r in day:
            if (r["option_a"] and len(r["option_a"]) > 22) or (r["option_b"] and len(r["option_b"]) > 22):
                bad += 1
    print(f"rows still over 22 chars after fix: {bad}")


if __name__ == "__main__":
    main()
