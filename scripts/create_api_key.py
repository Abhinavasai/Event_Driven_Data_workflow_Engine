#!/usr/bin/env python3
"""Create an API key via the gateway (bootstrap-friendly) or direct PostgreSQL insert."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import secrets
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone


def hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def create_via_api(base_url: str, name: str, role: str, admin_key: str) -> int:
    url = f"{base_url.rstrip('/')}/api/v1/api-keys"
    body = json.dumps({"name": name, "role": role}).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if admin_key:
        headers["X-API-Key"] = admin_key

    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        print(f"HTTP {exc.code}: {exc.read().decode('utf-8', errors='replace')}", file=sys.stderr)
        return 1
    except urllib.error.URLError as exc:
        print(f"Request failed: {exc.reason}", file=sys.stderr)
        return 1

    api_key = payload.get("api_key") or payload.get("key")
    print(json.dumps(payload, indent=2))
    if api_key:
        print("\n--- Save this key; it is shown only once ---")
        print(api_key)
    return 0


def create_via_db(dsn: str, name: str, role: str, raw_key: str | None) -> int:
    try:
        import psycopg
    except ImportError:
        try:
            import psycopg2 as psycopg  # type: ignore
        except ImportError:
            print("Install psycopg or psycopg2 for --db mode: pip install psycopg[binary]", file=sys.stderr)
            return 1

    raw = raw_key or secrets.token_urlsafe(48)
    key_hash = hash_key(raw)
    key_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # Normalize async DSN if needed
    dsn = dsn.replace("postgresql+asyncpg://", "postgresql://")

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO api_keys (id, key_hash, name, role, is_active, created_at)
                VALUES (%s, %s, %s, %s, TRUE, %s)
                ON CONFLICT (key_hash) DO NOTHING
                """,
                (key_id, key_hash, name, role, now),
            )
        conn.commit()

    print(json.dumps({"id": key_id, "name": name, "role": role, "api_key": raw}, indent=2))
    print("\n--- Save this key; it is shown only once ---")
    print(raw)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Create an API key for the workflow engine")
    parser.add_argument("--name", required=True, help="Human-readable key name")
    parser.add_argument("--role", default="admin", choices=["admin", "operator", "viewer"])
    parser.add_argument("--base-url", default=os.environ.get("API_BASE_URL", "http://localhost:8000"))
    parser.add_argument("--admin-key", default=os.environ.get("ADMIN_API_KEY", ""))
    parser.add_argument(
        "--db",
        action="store_true",
        help="Insert directly into PostgreSQL (bypasses API). Uses DATABASE_URL / POSTGRES_URL.",
    )
    parser.add_argument("--raw-key", default=None, help="Optional fixed raw key when using --db")
    args = parser.parse_args()

    if args.db:
        dsn = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
        if not dsn:
            # Local docker default from .env
            dsn = "postgresql://workflow_user:workflow_dev_pass@localhost:5432/workflow_engine"
        return create_via_db(dsn, args.name, args.role, args.raw_key)

    return create_via_api(args.base_url, args.name, args.role, args.admin_key)


if __name__ == "__main__":
    raise SystemExit(main())
