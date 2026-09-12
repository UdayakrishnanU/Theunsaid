#!/usr/bin/env python3
"""
One-time launch seed script for AnonVerdict.

Reads scripts/db_rows.json (469 confession/dilemma posts — the original
seed set, rewritten to make better use of the 800-char post limit, plus
12 new curiosity-bait posts) and inserts them into the live `posts` table
via the Supabase REST API, using the service role key from .env.local.

Usage:
    cd the-unsaid
    python3 scripts/inject_seed.py

Safe to run once. Each row has a fixed, already-generated id, so re-running
this script will fail on the primary-key conflict for rows already inserted
rather than silently duplicating them (Postgres will just error that batch —
delete scripts/db_rows.json rows you don't want re-tried, or ignore, since
nothing is double-inserted).
"""
import json
import re
import urllib.request
import urllib.error
import sys
import os

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

with open(os.path.join(HERE, "db_rows.json")) as f:
    rows = json.load(f)

BATCH = 40
endpoint = url.rstrip("/") + "/rest/v1/posts"
headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

ok, fail = 0, 0
for i in range(0, len(rows), BATCH):
    chunk = rows[i:i + BATCH]
    data = json.dumps(chunk).encode()
    req = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            ok += len(chunk)
            print(f"batch {i}-{i + len(chunk)}: OK ({resp.status})")
    except urllib.error.HTTPError as e:
        fail += len(chunk)
        print(f"batch {i}-{i + len(chunk)}: ERROR {e.code} {e.read()[:400]}")

print(f"\nDone. inserted={ok} failed={fail} total={len(rows)}")
