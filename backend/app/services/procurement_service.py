import json
from datetime import timedelta
from decimal import Decimal

from fastapi import HTTPException

from app.core.decimal_utils import from_d128, to_d128
from app.core.utils import utc_now
from app.logic.inventory import IncomingOrder, analyze_inventory
from app.logic.landed_cost import (
    LandedCost, compare_routes, domestic_landed_cost, international_landed_cost,
)
from app.logic.procurement_decision import decide
from app.logic.replenishment import (
    SourcingOption, ReplenishmentStatus, allocate_replenishment, free_storage,
    required_quantity, target_inventory_position,
)
from app.schemas.procurement import ProcurementRequest, ProcurementResponse
from app.schemas.scenarios import ScenarioOverrides

CALC_VERSION = "1.0"
ZERO = Decimal("0")
ONE = Decimal("1")


def _safe(obj):
    """JSON-safe copy (Decimal, date and datetime become strings)."""
    return json.loads(json.dumps(obj, default=str))


def _mult(pct: Decimal) -> Decimal:
    return ONE + pct / Decimal("100")


def _bad_cost(route: str, msg: str) -> LandedCost:
    return LandedCost(route, {}, None, ["invalid_input"], [msg])


def _dec(doc: dict, key: str) -> Decimal:
    return from_d128(doc.get(key, 0))


def recommend(db, req: ProcurementRequest, user_id: str,
              overrides: ScenarioOverrides | None = None,
              persist: bool = True) -> ProcurementResponse:
    ov = overrides or ScenarioOverrides()
    now = utc_now()
    max_age = timedelta(days=req.max_data_age_days)
    warnings: list[str] = []
    hard: list[str] = []          # problems that force REVIEW

    # ---------- load data ----------
    inv = db.inventory.find_one({"commodity": "SOYBEAN"}, sort=[("as_of", -1)])
    if not inv:
        hard.append("No inventory record found.")
    elif now - inv["as_of"] > max_age:
        hard.append(f"Inventory record is older than {req.max_data_age_days} days.")

    suppliers = [
        {**s, "lead_time_days": max(1, s["lead_time_days"] + ov.lead_time_change_days)}
        for s in db.suppliers.find({"active": True})
    ]
    if not suppliers:
        hard.append("No active suppliers.")

    end = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
    start = end - timedelta(days=req.consumption_days - 1)
    cons_mult = _mult(ov.consumption_change_pct)
    history = [from_d128(d["consumption_mt"]) * cons_mult
               for d in db.consumption.find({"date": {"$gte": start, "$lte": end}}).sort("date", 1)]
    if len(history) < 7:
        hard.append("Fewer than 7 days of consumption data in the period.")
    elif len(history) < req.consumption_days:
        warnings.append(f"Consumption is incomplete: {len(history)} of {req.consumption_days} days recorded "
                        "(missing days are not treated as zero).")

    if hard:
        result = decide(None, None, None, hard)
        return _finish(db, req, user_id, now, result, None, None, {}, {}, None,
                       warnings, "INCOMPLETE", persist)

    # ---------- inventory (with scenario change) ----------
    available = from_d128(inv["available_stock_mt"]) + ov.inventory_change_mt
    reserved = from_d128(inv["reserved_stock_mt"])
    capacity = from_d128(inv["storage_capacity_mt"])
    if available < reserved or available > capacity:
        raise HTTPException(status_code=422, detail="Scenario inventory change puts available stock "
                            "below reserved stock or above storage capacity")

    # ---------- landed cost ----------
    dom_price = db.market_prices.find_one({"commodity": "SOYBEAN", "market_type": "DOMESTIC"},
                                          sort=[("observed_at", -1)])
    intl_price = db.market_prices.find_one({"commodity": "SOYBEAN", "market_type": "INTERNATIONAL"},
                                           sort=[("observed_at", -1)])
    fx = db.exchange_rates.find_one({"base_currency": "USD", "quote_currency": "INR"},
                                    sort=[("observed_at", -1)])
    dom_log = db.logistics_costs.find_one({"sourcing_type": "DOMESTIC"}, sort=[("effective_from", -1)])
    intl_log = db.logistics_costs.find_one({"sourcing_type": "INTERNATIONAL"}, sort=[("effective_from", -1)])
    freight_mult = _mult(ov.freight_change_pct)

    dom_cost = None
    if not dom_price or now - dom_price["observed_at"] > max_age:
        warnings.append("Domestic price is missing or stale: the domestic route is excluded.")
    elif dom_price["currency"] != "INR":
        warnings.append("Domestic price is not in INR: the domestic route is excluded.")
    elif not dom_log:
        warnings.append("Domestic logistics costs are missing: the domestic route is excluded.")
    else:
        try:
            dom_cost = domestic_landed_cost(
                _dec(dom_price, "price_per_mt") * _mult(ov.domestic_price_change_pct),
                _dec(dom_log, "freight_per_mt") * freight_mult,
                _dec(dom_log, "port_handling_per_mt") + _dec(dom_log, "inland_transport_per_mt"),
                _dec(dom_log, "other_costs_per_mt"),
                input_dates={"price": dom_price["observed_at"].date(),
                             "logistics": dom_log["effective_from"].date()})
        except ValueError as e:
            dom_cost = _bad_cost("DOMESTIC", str(e))

    intl_cost = None
    if not intl_price or now - intl_price["observed_at"] > max_age:
        warnings.append("International price is missing or stale: the international route is excluded.")
    elif intl_price["currency"] != "USD":
        warnings.append("International price is not in USD: the international route is excluded.")
    elif not fx or now - fx["observed_at"] > max_age:
        warnings.append("USD/INR exchange rate is missing or stale: the international route is excluded.")
    elif not intl_log:
        warnings.append("International logistics costs are missing: the international route is excluded.")
    else:
        try:
            intl_cost = international_landed_cost(
                foreign_price_per_mt=_dec(intl_price, "price_per_mt") * _mult(ov.international_price_change_pct),
                exchange_rate=from_d128(fx["rate"]) * _mult(ov.usd_inr_change_pct),
                incoterm=req.incoterm,
                freight_per_mt=_dec(intl_log, "freight_per_mt") * freight_mult,
                insurance_per_mt=_dec(intl_log, "insurance_per_mt"),
                customs_duty_rate=req.customs_duty_rate,
                port_handling_per_mt=_dec(intl_log, "port_handling_per_mt"),
                inland_transport_per_mt=_dec(intl_log, "inland_transport_per_mt"),
                other_per_mt=_dec(intl_log, "other_costs_per_mt"),
                non_recoverable_tax_rate=req.non_recoverable_tax_rate,
                recoverable_tax_rate=req.recoverable_tax_rate,
                exchange_rate_source=fx.get("source"),
                input_dates={"price": intl_price["observed_at"].date(),
                             "exchange_rate": fx["observed_at"].date(),
                             "logistics": intl_log["effective_from"].date()})
            if intl_cost.missing_inputs:
                warnings.append("International cost is incomplete (missing: "
                                + ", ".join(intl_cost.missing_inputs) + "): the route is excluded.")
        except ValueError as e:
            intl_cost = _bad_cost("INTERNATIONAL", str(e))
            warnings.append(f"International cost could not be calculated: {e}")

    costs = {"DOMESTIC": dom_cost, "INTERNATIONAL": intl_cost}
    comparison = compare_routes(dom_cost, intl_cost) if dom_cost and intl_cost else None

    # ---------- inventory analysis ----------
    lead_time = min(s["lead_time_days"] for s in suppliers)      # fastest replenishment available

    orders = []
    for po in db.purchase_orders.find({"status": {"$in": ["CONFIRMED", "IN_TRANSIT"]}}):
        remaining = from_d128(po["quantity_mt"]) - from_d128(po["received_quantity_mt"])
        if remaining > 0:
            orders.append(IncomingOrder(remaining, po["expected_arrival"].date()))

    analysis = analyze_inventory(now.date(), available, reserved, history, lead_time, orders,
                                 req.service_level, req.fixed_safety_stock_mt)
    warnings.extend(analysis.warnings)

    # ---------- replenishment ----------
    plan = None
    target = required = free = None
    cannot_beat = False
    if analysis.safety_stock_mt is not None and analysis.avg_daily_consumption_mt:
        target = target_inventory_position(analysis.avg_daily_consumption_mt, lead_time,
                                           req.planning_horizon_days, analysis.safety_stock_mt,
                                           req.strategic_stock_mt)
        required = required_quantity(target, analysis.inventory_position_mt)
        free = free_storage(capacity, available, analysis.incoming_mt)

    if analysis.status.value in ("REORDER_REQUIRED", "CRITICAL") and required is not None:
        options = [SourcingOption(str(s["_id"]), s["supplier_name"], s["sourcing_type"],
                                  costs[s["sourcing_type"]].total_per_mt if costs[s["sourcing_type"]] else None,
                                  from_d128(s["capacity_mt"]), from_d128(s["minimum_order_mt"]),
                                  s["lead_time_days"]) for s in suppliers]
        limit = analysis.depletion.days_until_stock_out if analysis.status.value == "CRITICAL" else None
        plan = allocate_replenishment(required, options, free, req.budget_inr, limit)
        if plan.status == ReplenishmentStatus.NONE_FEASIBLE and limit is not None:
            plan = allocate_replenishment(required, options, free, req.budget_inr, None)
            cannot_beat = plan.status != ReplenishmentStatus.NONE_FEASIBLE

    # ---------- forecast (read-only, context only) ----------
    fc = db.forecasts.find_one({"commodity": "SOYBEAN", "market_type": "DOMESTIC", "horizon_days": 7},
                               sort=[("created_at", -1)])
    forecast_info = None
    if fc:
        forecast_info = {"direction": fc["direction"], "model": fc["model_name"],
                         "quality_status": fc["quality_status"],
                         "training_data_end": fc["training_data_end"].date()}

    result = decide(analysis, plan, comparison, [], fc["direction"] if fc else None,
                    bool(fc and fc["quality_status"] == "VALID"), cannot_beat)

    inventory_info = {
        "available_stock_mt": available, "reserved_stock_mt": reserved,
        "usable_on_hand_mt": analysis.usable_on_hand_mt, "incoming_mt": analysis.incoming_mt,
        "inventory_position_mt": analysis.inventory_position_mt,
        "avg_daily_consumption_mt": analysis.avg_daily_consumption_mt,
        "coverage_days": analysis.coverage_days, "safety_stock_mt": analysis.safety_stock_mt,
        "safety_stock_method": analysis.safety_stock_method, "reorder_point_mt": analysis.reorder_point_mt,
        "inventory_status": analysis.status.value,
        "days_until_stock_out": analysis.depletion.days_until_stock_out if analysis.depletion else None,
        "target_position_mt": target, "required_replenishment_mt": required, "free_storage_mt": free,
        "lead_time_used_days": lead_time,
    }
    market_info = {
        "domestic_landed_cost_per_mt": dom_cost.total_per_mt if dom_cost else None,
        "international_landed_cost_per_mt": intl_cost.total_per_mt if intl_cost else None,
        "cheaper_route": comparison.cheaper_route if comparison else None,
        "difference_per_mt": comparison.difference_per_mt if comparison else None,
        "domestic_components": dom_cost.components if dom_cost else None,
        "international_components": intl_cost.components if intl_cost else None,
        "usd_inr_rate": from_d128(fx["rate"]) * _mult(ov.usd_inr_change_pct) if fx else None,
    }
    status = "VALID" if not warnings else "WARNING"
    if overrides is not None:
        warnings.append("Scenario overrides applied. No market, inventory or decision records were changed.")
    return _finish(db, req, user_id, now, result, plan, analysis, inventory_info, market_info,
                   forecast_info, warnings, status, persist)


def _finish(db, req, user_id, now, result, plan, analysis, inventory_info, market_info,
            forecast_info, warnings, status, persist) -> ProcurementResponse:
    qty = result.recommended_quantity_mt
    total_cost = plan.total_cost_inr if plan and result.decision.value == "BUY" else ZERO
    avg_cost = (total_cost / qty).quantize(Decimal("0.01")) if qty > 0 else None
    allocations = ([{"supplier_id": a.supplier_id, "supplier_name": a.supplier_name, "route": a.route,
                     "quantity_mt": a.quantity_mt, "landed_cost_per_mt": a.landed_cost_per_mt,
                     "total_cost_inr": a.total_cost_inr, "lead_time_days": a.lead_time_days,
                     "notes": a.notes} for a in plan.allocations]
                   if plan and result.decision.value == "BUY" else [])

    body = _safe({
        "decision": result.decision.value, "sourcing_route": result.sourcing_route,
        "recommended_quantity_mt": qty, "shortfall_mt": result.shortfall_mt,
        "expected_landed_cost_per_mt": avg_cost, "total_cost_inr": total_cost,
        "allocations": allocations, "inventory": inventory_info, "market": market_info,
        "forecast": forecast_info, "reasoning": result.reasoning, "triggers": result.triggers,
        "rejected_alternatives": result.rejected_alternatives, "warnings": warnings,
        "data_quality_status": status, "calculation_version": CALC_VERSION,
        "inputs": req.model_dump(mode="json"),
    })

    decision_id = "NOT_SAVED"
    if persist:
        doc = {
            "decision_date": now,
            "action": result.decision.value,
            "sourcing_route": result.sourcing_route,
            "recommended_quantity_mt": to_d128(qty),
            "expected_landed_cost_per_mt": to_d128(avg_cost) if avg_cost is not None else None,
            "inventory_coverage_days": (to_d128(analysis.coverage_days)
                                        if analysis and analysis.coverage_days is not None else None),
            "reasoning": result.reasoning,
            "data_quality_status": status,
            "snapshot": body,
            "created_by": user_id,
            "created_at": now,
        }
        decision_id = str(db.procurement_decisions.insert_one(doc).inserted_id)
    return ProcurementResponse(decision_id=decision_id, decision_timestamp=now, **body)