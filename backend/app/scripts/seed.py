"""Insert clearly labelled SIMULATED_DATA. Safe to re-run.
Run from the backend folder:  python -m app.scripts.seed
All base values are arbitrary placeholders, NOT real market prices."""
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from bson.decimal128 import Decimal128
from pymongo.errors import BulkWriteError

from app.database import connection
from app.database.indexes import create_indexes

SRC = "SIMULATED_DATA"


def d(x) -> Decimal128:
    return Decimal128(Decimal(str(round(x, 2))))


def insert_ignoring_duplicates(col, docs):
    try:
        col.insert_many(docs, ordered=False)
    except BulkWriteError:
        pass  # duplicates skipped by the unique indexes


def main():
    connection.connect()
    create_indexes()
    db = connection.get_db()
    rng = random.Random(42)  # fixed seed, so the data is repeatable

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    days = [today - timedelta(days=n) for n in range(90, 0, -1)]
    now = datetime.now(timezone.utc)

    # market prices: a small random walk per market
    series = [
        ("DOMESTIC", "Sample Domestic Market", "INR", 48000.0),
        ("INTERNATIONAL", "Sample International Market", "USD", 530.0),
    ]
    prices = []
    for market_type, name, currency, p in series:
        for day in days:
            p *= 1 + rng.uniform(-0.01, 0.01)
            prices.append({
                "commodity": "SOYBEAN", "market_type": market_type, "market_name": name,
                "price": d(p), "currency": currency, "unit": "MT", "price_per_mt": d(p),
                "observed_at": day, "source": SRC, "quality_grade": None,
                "data_quality_status": "VALID", "created_at": now,
            })
    insert_ignoring_duplicates(db.market_prices, prices)

    # consumption: last 60 days
    insert_ignoring_duplicates(db.consumption, [
        {"date": day, "consumption_mt": round(rng.uniform(450, 550), 1), "source": SRC}
        for day in days[-60:]
    ])

    # single-record collections: only seed when no simulated record exists yet
    if db.inventory.count_documents({"source": SRC}) == 0:
        db.inventory.insert_one({
            "commodity": "SOYBEAN", "available_stock_mt": 5000, "reserved_stock_mt": 0,
            "storage_capacity_mt": 15000, "as_of": now, "source": SRC,
        })

    if db.suppliers.count_documents({"source": SRC}) == 0:
        db.suppliers.insert_many([
            {"supplier_name": "Sample Domestic Supplier", "sourcing_type": "DOMESTIC",
             "lead_time_days": 10, "capacity_mt": 5000, "minimum_order_mt": 100,
             "quality_specification": {}, "active": True, "source": SRC},
            {"supplier_name": "Sample International Supplier", "sourcing_type": "INTERNATIONAL",
             "lead_time_days": 45, "capacity_mt": 10000, "minimum_order_mt": 1000,
             "quality_specification": {}, "active": True, "source": SRC},
        ])

    if db.exchange_rates.count_documents({"source": SRC}) == 0:
        rate, rows = 84.0, []
        for day in days:
            rate *= 1 + rng.uniform(-0.003, 0.003)
            rows.append({"base_currency": "USD", "quote_currency": "INR",
                         "rate": Decimal128(Decimal(str(round(rate, 4)))),
                         "observed_at": day, "source": SRC})
        db.exchange_rates.insert_many(rows)

    if db.logistics_costs.count_documents({"source": SRC}) == 0:
        db.logistics_costs.insert_many([
            {"sourcing_type": "DOMESTIC", "freight_per_mt": d(800), "insurance_per_mt": d(0),
             "port_handling_per_mt": d(0), "inland_transport_per_mt": d(0),
             "other_costs_per_mt": d(150), "currency": "INR",
             "effective_from": today - timedelta(days=90), "source": SRC},
            {"sourcing_type": "INTERNATIONAL", "freight_per_mt": d(2500), "insurance_per_mt": d(300),
             "port_handling_per_mt": d(1000), "inland_transport_per_mt": d(1200),
             "other_costs_per_mt": d(0), "currency": "INR",
             "effective_from": today - timedelta(days=90), "source": SRC},
        ])

    print("Seed complete (SIMULATED_DATA)")
    connection.close()


if __name__ == "__main__":
    main()