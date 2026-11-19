from typing import Any

from fastapi import APIRouter, Depends

from app.api.auth import get_current_user
from app.core.decimal_utils import from_d128
from app.core.utils import utc_now
from app.database.connection import get_db

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])
STALE_DAYS = 7


def _age_days(now, ts) -> float:
    return round((now - ts).total_seconds() / 86400, 1)


@router.get("", response_model=dict[str, Any])
def dashboard(user: dict = Depends(get_current_user)):
    db = get_db()
    now = utc_now()
    alerts: list[str] = []

    # inventory
    inv = db.inventory.find_one({"commodity": "SOYBEAN"}, sort=[("as_of", -1)])
    inventory = None
    if inv:
        available, reserved = from_d128(inv["available_stock_mt"]), from_d128(inv["reserved_stock_mt"])
        capacity = from_d128(inv["storage_capacity_mt"])
        age = _age_days(now, inv["as_of"])
        inventory = {"available_stock_mt": available, "reserved_stock_mt": reserved,
                     "net_available_stock_mt": available - reserved, "storage_capacity_mt": capacity,
                     "free_storage_mt": capacity - available, "as_of": inv["as_of"], "age_days": age}
        if age > STALE_DAYS:
            alerts.append(f"Inventory data is {age} days old.")
    else:
        alerts.append("No inventory record found.")

    # incoming purchase orders
    open_orders = list(db.purchase_orders.find(
        {"status": {"$in": ["CONFIRMED", "IN_TRANSIT"]}}).sort("expected_arrival", 1))
    incoming_mt = sum((from_d128(o["quantity_mt"]) - from_d128(o["received_quantity_mt"])
                       for o in open_orders), start=from_d128(0))
    incoming = {"open_orders": len(open_orders), "incoming_mt": incoming_mt,
                "next_arrival": open_orders[0]["expected_arrival"] if open_orders else None}

    # latest saved decision
    dec = db.procurement_decisions.find_one(sort=[("decision_date", -1)])
    decision = None
    if dec:
        decision = {
            "id": str(dec["_id"]), "decision_date": dec["decision_date"], "action": dec["action"],
            "sourcing_route": dec.get("sourcing_route"),
            "recommended_quantity_mt": from_d128(dec["recommended_quantity_mt"]),
            "coverage_days": (from_d128(dec["inventory_coverage_days"])
                              if dec.get("inventory_coverage_days") is not None else None),
            "data_quality_status": dec["data_quality_status"], "reasoning": dec["reasoning"],
            "age_hours": round((now - dec["decision_date"]).total_seconds() / 3600, 1),
        }
        if inv and dec["decision_date"] < inv["as_of"]:
            alerts.append("The latest decision is older than the latest inventory update: "
                          "run POST /procurement/recommend to refresh it.")
    else:
        alerts.append("No decision yet: run POST /procurement/recommend.")

    # latest prices and exchange rate
    prices = {}
    for market_type in ("DOMESTIC", "INTERNATIONAL"):
        p = db.market_prices.find_one({"commodity": "SOYBEAN", "market_type": market_type},
                                      sort=[("observed_at", -1)])
        if not p:
            alerts.append(f"No {market_type.lower()} price found.")
            continue
        age = _age_days(now, p["observed_at"])
        prices[market_type] = {"market_name": p["market_name"], "price_per_mt": from_d128(p["price_per_mt"]),
                               "currency": p["currency"], "observed_at": p["observed_at"], "age_days": age,
                               "source": p["source"], "data_quality_status": p.get("data_quality_status", "VALID")}
        if age > STALE_DAYS:
            alerts.append(f"{market_type.title()} price is {age} days old.")
        if p["source"] == "SIMULATED_DATA":
            alerts.append(f"{market_type.title()} price comes from SIMULATED_DATA, not verified market data.")

    fx_doc = db.exchange_rates.find_one({"base_currency": "USD", "quote_currency": "INR"},
                                        sort=[("observed_at", -1)])
    fx = None
    if fx_doc:
        fx = {"rate": from_d128(fx_doc["rate"]), "observed_at": fx_doc["observed_at"],
              "source": fx_doc["source"], "age_days": _age_days(now, fx_doc["observed_at"])}
        if fx["age_days"] > STALE_DAYS:
            alerts.append(f"USD/INR rate is {fx['age_days']} days old.")

    # latest stored forecast (never trains)
    fc = db.forecasts.find_one({"commodity": "SOYBEAN", "market_type": "DOMESTIC", "horizon_days": 7},
                               sort=[("created_at", -1)])
    forecast = None
    if fc:
        forecast = {"direction": fc["direction"], "predicted_price": from_d128(fc["predicted_price"]),
                    "model_name": fc["model_name"], "quality_status": fc["quality_status"],
                    "training_data_end": fc["training_data_end"].date(), "created_at": fc["created_at"],
                    "note": "Statistical estimate, not a guaranteed market price."}

    return {"generated_at": now, "inventory": inventory, "incoming_orders": incoming,
            "latest_decision": decision, "prices": prices, "usd_inr": fx, "forecast": forecast,
            "alerts": alerts}