#!/usr/bin/env python3
"""Seed sample workflow definitions through the API gateway."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

ORDER_STEPS = [
    {
        "step_name": "ingest",
        "step_type": "INGEST",
        "step_order": 1,
        "max_retries": 3,
        "config": {"encoding": "utf-8", "delimiter": ","},
    },
    {
        "step_name": "validate",
        "step_type": "VALIDATE",
        "step_order": 2,
        "max_retries": 2,
        "config": {
            "required_columns": ["order_id", "customer_name", "amount", "order_date", "status"],
            "column_types": {
                "order_id": "string",
                "amount": "number",
                "order_date": "date",
            },
        },
    },
    {
        "step_name": "transform",
        "step_type": "TRANSFORM",
        "step_order": 3,
        "max_retries": 3,
        "config": {
            "transformations": [
                {"type": "normalize", "config": {"columns": ["customer_name"], "operations": ["trim", "title_case"]}},
                {"type": "type_cast", "config": {"amount": "float64", "order_date": "datetime"}},
                {"type": "dedup", "config": {"key_columns": ["order_id"]}},
            ]
        },
    },
    {
        "step_name": "load",
        "step_type": "LOAD",
        "step_order": 4,
        "max_retries": 3,
        "config": {
            "target_table": "orders_imported",
            "load_mode": "upsert",
            "conflict_columns": ["order_id"],
            "batch_size": 5000,
        },
    },
]

PRODUCT_STEPS = [
    {
        "step_name": "ingest",
        "step_type": "INGEST",
        "step_order": 1,
        "max_retries": 3,
        "config": {},
    },
    {
        "step_name": "validate",
        "step_type": "VALIDATE",
        "step_order": 2,
        "max_retries": 2,
        "config": {
            "required_fields": ["product_id", "name", "category", "price", "in_stock"],
        },
    },
    {
        "step_name": "transform",
        "step_type": "TRANSFORM",
        "step_order": 3,
        "max_retries": 3,
        "config": {
            "transformations": [
                {"type": "type_cast", "config": {"price": "float64", "in_stock": "bool"}},
            ]
        },
    },
    {
        "step_name": "load",
        "step_type": "LOAD",
        "step_order": 4,
        "max_retries": 3,
        "config": {
            "target_table": "products_imported",
            "load_mode": "upsert",
            "conflict_columns": ["product_id"],
            "batch_size": 5000,
        },
    },
]

DEFINITIONS = [
    {
        "name": "Order Import Pipeline",
        "description": "CSV order import with validation, transform, and upsert load",
        "file_type": "csv",
        "steps_config": ORDER_STEPS,
        "is_active": True,
    },
    {
        "name": "Product Catalog Sync",
        "description": "JSON product catalog sync pipeline",
        "file_type": "json",
        "steps_config": PRODUCT_STEPS,
        "is_active": True,
    },
]


def post_definition(base_url: str, api_key: str, definition: dict) -> dict:
    url = f"{base_url.rstrip('/')}/api/v1/workflows"
    body = json.dumps(definition).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "X-API-Key": api_key},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    base_url = os.environ.get("API_BASE_URL", "http://localhost:8000")
    api_key = os.environ.get("API_KEY") or os.environ.get("ADMIN_API_KEY")
    if not api_key:
        print("Set API_KEY or ADMIN_API_KEY environment variable.", file=sys.stderr)
        return 1

    for definition in DEFINITIONS:
        try:
            created = post_definition(base_url, api_key, definition)
            print(f"Created: {created.get('name', definition['name'])} ({created.get('id', 'unknown id')})")
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            if exc.code == 409 or "unique" in body.lower():
                print(f"Skipped (may exist): {definition['name']}")
            else:
                print(f"Failed {definition['name']}: HTTP {exc.code} {body}", file=sys.stderr)
                return 1
        except urllib.error.URLError as exc:
            print(f"Request failed: {exc.reason}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
