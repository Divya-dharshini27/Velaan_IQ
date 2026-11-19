from pymongo import ASCENDING, DESCENDING
from app.database.connection import get_db


def create_indexes():
    db = get_db()

    db.users.create_index([("email", ASCENDING)], unique=True, name="uniq_email")

    db.market_prices.create_index(
        [("commodity", ASCENDING), ("market_type", ASCENDING), ("observed_at", DESCENDING)],
        name="commodity_type_observed",
    )
    # blocks exact duplicate price records
    db.market_prices.create_index(
        [("commodity", ASCENDING), ("market_type", ASCENDING),
         ("market_name", ASCENDING), ("observed_at", ASCENDING)],
        unique=True,
        name="uniq_price_record",
    )

    db.consumption.create_index([("date", ASCENDING)], unique=True, name="uniq_consumption_date")

    db.purchase_orders.create_index(
        [("status", ASCENDING), ("expected_arrival", ASCENDING)],
        name="status_arrival",
    )

    db.suppliers.create_index(
        [("sourcing_type", ASCENDING), ("active", ASCENDING)],
        name="type_active",
    )

    db.exchange_rates.create_index(
        [("base_currency", ASCENDING), ("quote_currency", ASCENDING), ("observed_at", DESCENDING)],
        name="pair_observed",
    )

    db.forecasts.create_index(
        [("commodity", ASCENDING), ("target_date", ASCENDING)],
        name="commodity_target",
    )

    db.procurement_decisions.create_index(
        [("decision_date", DESCENDING)],
        name="decision_date",
    )
    db.inventory.create_index(
        [("commodity", ASCENDING), ("as_of", DESCENDING)],
        name="commodity_asof",
    )
    print("Indexes ready")