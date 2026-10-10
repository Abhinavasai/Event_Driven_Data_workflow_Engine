#!/usr/bin/env python3
"""Generate sample CSV/JSON files under sample-data/."""

from __future__ import annotations

import csv
import json
import random
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAMPLE_DIR = ROOT / "sample-data"

STATUSES = ["pending", "shipped", "delivered", "cancelled"]
CATEGORIES = ["Electronics", "Home", "Apparel", "Sports", "Books"]


def write_orders_csv(path: Path, rows: int = 100) -> None:
    start = date(2025, 1, 1)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=["order_id", "customer_name", "amount", "order_date", "status"],
        )
        writer.writeheader()
        for i in range(1, rows + 1):
            writer.writerow(
                {
                    "order_id": f"ORD-{1000 + i}",
                    "customer_name": f"Customer {i}",
                    "amount": f"{random.uniform(10, 500):.2f}",
                    "order_date": (start + timedelta(days=i % 120)).isoformat(),
                    "status": random.choice(STATUSES),
                }
            )


def write_products_json(path: Path, count: int = 75) -> None:
    products = []
    for i in range(1, count + 1):
        products.append(
            {
                "product_id": f"PRD-{2000 + i}",
                "name": f"Product {i}",
                "category": random.choice(CATEGORIES),
                "price": round(random.uniform(5, 250), 2),
                "in_stock": random.choice([True, False]),
            }
        )
    path.write_text(json.dumps(products, indent=2), encoding="utf-8")


def write_malformed_csv(path: Path) -> None:
    path.write_text(
        "order_id,customer_name,amount,order_date\n"
        "ORD-BAD-1,Alice,not-a-number,2025-01-01\n"
        "ORD-BAD-2,,45.00,not-a-date\n"
        "ORD-BAD-1,Bob,12.50,2025-02-01\n",
        encoding="utf-8",
    )


def main() -> None:
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
    (SAMPLE_DIR / "input").mkdir(exist_ok=True)
    write_orders_csv(SAMPLE_DIR / "sample_orders.csv")
    write_products_json(SAMPLE_DIR / "sample_products.json")
    write_malformed_csv(SAMPLE_DIR / "sample_malformed.csv")
    print(f"Generated files in {SAMPLE_DIR}")


if __name__ == "__main__":
    main()
