from datetime import date
from decimal import Decimal as D

from app.logic.inventory import InventoryStatus, analyze_inventory
from app.logic.landed_cost import LandedCost, compare_routes
from app.logic.procurement_decision import Decision, decide
from app.logic.replenishment import SourcingOption, allocate_replenishment

START = date(2026, 11, 9)
DOM = SourcingOption("d1", "Domestic Supplier", "DOMESTIC", D("46050"), D("5000"), D("100"), 10)
INTL = SourcingOption("i1", "Intl Supplier", "INTERNATIONAL", D("48064"), D("10000"), D("1000"), 45)
CHEAP_INTL = SourcingOption("i1", "Intl Supplier", "INTERNATIONAL", D("44000"), D("10000"), D("1000"), 45)

COMPARISON = compare_routes(LandedCost("DOMESTIC", {}, D("46050.00"), [], []),
                            LandedCost("INTERNATIONAL", {}, D("48064.00"), [], []))


def inv(available):
    # constant 500 MT/day, lead time 10, fixed safety stock 1000 -> reorder point 6000
    return analyze_inventory(START, D(str(available)), D("0"), [D("500")] * 30, 10, [],
                             fixed_safety_stock_mt=D("1000"))


def text(result):
    return " ".join(result.reasoning)


# ---- WAIT ----
def test_healthy_inventory_waits():
    a = inv(20000)
    assert a.status == InventoryStatus.HEALTHY
    r = decide(a, None, COMPARISON, [])
    assert r.decision == Decision.WAIT
    assert r.recommended_quantity_mt == D("0")


def test_watch_status_waits_with_a_monitoring_note():
    a = inv(7000)                       # above 6000, within 5 days of demand (8500)
    assert a.status == InventoryStatus.WATCH
    r = decide(a, None, COMPARISON, [])
    assert r.decision == Decision.WAIT
    assert "monitor closely" in text(r)


def test_healthy_stock_and_validated_price_rise_flags_early_purchase_review():
    r = decide(inv(20000), None, COMPARISON, [], forecast_direction="UP", forecast_valid=True)
    assert r.decision == Decision.WAIT
    assert "early purchase" in text(r)


def test_unvalidated_forecast_is_not_used():
    r = decide(inv(20000), None, COMPARISON, [], forecast_direction="DOWN", forecast_valid=False)
    assert "not validated" in text(r)


# ---- BUY ----
def test_reorder_required_buys_from_domestic():
    a = inv(5000)
    assert a.status == InventoryStatus.REORDER_REQUIRED
    plan = allocate_replenishment(D("3000"), [DOM, INTL], D("10000"))
    r = decide(a, plan, COMPARISON, [])
    assert r.decision == Decision.BUY
    assert r.sourcing_route == "DOMESTIC"
    assert r.recommended_quantity_mt == D("3000")
    assert r.shortfall_mt == D("0")
    assert "REORDER_REQUIRED" in r.triggers


def test_forecast_price_drop_does_not_stop_a_reorder():
    plan = allocate_replenishment(D("3000"), [DOM, INTL], D("10000"))
    r = decide(inv(5000), plan, COMPARISON, [], forecast_direction="DOWN", forecast_valid=True)
    assert r.decision == Decision.BUY
    assert "does not justify waiting" in text(r)


def test_critical_stock_buys_even_with_forecast_price_drop():
    a = inv(2000)
    assert a.status == InventoryStatus.CRITICAL
    plan = allocate_replenishment(D("3000"), [DOM, INTL], D("10000"))
    r = decide(a, plan, COMPARISON, [], forecast_direction="DOWN", forecast_valid=True,
               cannot_beat_stock_out=True)
    assert r.decision == Decision.BUY
    assert "Supply continuity takes priority" in text(r)
    assert "WARNING" in text(r)                       # no supplier can arrive before the stock-out


# ---- route selection ----
def test_cheaper_route_unavailable_because_too_slow():
    # international is cheaper (44,000 vs 46,050) but needs 45 days; only 15 are available
    cmp = compare_routes(LandedCost("DOMESTIC", {}, D("46050.00"), [], []),
                         LandedCost("INTERNATIONAL", {}, D("44000.00"), [], []))
    assert cmp.cheaper_route == "INTERNATIONAL"
    plan = allocate_replenishment(D("3000"), [DOM, CHEAP_INTL], D("10000"), max_lead_time_days=15)
    r = decide(inv(5000), plan, cmp, [])
    assert r.decision == Decision.BUY and r.sourcing_route == "DOMESTIC"
    assert "differs from the cheapest" in text(r)
    assert any("lead time" in x for x in r.rejected_alternatives)


def test_missing_exchange_rate_domestic_still_used():
    # no international comparison possible: only the domestic option has a cost
    no_quote = SourcingOption("i1", "Intl Supplier", "INTERNATIONAL", None, D("10000"), D("1000"), 45)
    plan = allocate_replenishment(D("3000"), [DOM, no_quote], D("10000"))
    r = decide(inv(5000), plan, None, [])
    assert r.decision == Decision.BUY and r.sourcing_route == "DOMESTIC"
    assert "Landed cost per MT" not in text(r)
    assert any("Intl Supplier" in x for x in r.rejected_alternatives)


# ---- constraints ----
def test_supplier_capacity_insufficient_reports_shortfall():
    plan = allocate_replenishment(D("11000"), [DOM], D("20000"))
    r = decide(inv(5000), plan, COMPARISON, [])
    assert r.decision == Decision.BUY
    assert r.recommended_quantity_mt == D("5000")
    assert r.shortfall_mt == D("6000")
    assert "Shortfall" in text(r)


def test_moq_raises_a_small_requirement():
    plan = allocate_replenishment(D("50"), [DOM], D("10000"))
    r = decide(inv(5000), plan, COMPARISON, [])
    assert r.decision == Decision.BUY
    assert r.recommended_quantity_mt == D("100")


def test_storage_constraint_limits_quantity():
    plan = allocate_replenishment(D("11000"), [DOM, INTL], D("3000"))
    r = decide(inv(5000), plan, COMPARISON, [])
    assert r.recommended_quantity_mt == D("3000")
    assert r.shortfall_mt == D("8000")
    assert "storage space" in text(r)


# ---- REVIEW ----
def test_missing_market_data_gives_review():
    no_quote = SourcingOption("x1", "No Quote Supplier", "DOMESTIC", None, D("5000"), D("100"), 10)
    plan = allocate_replenishment(D("3000"), [no_quote], D("10000"))
    r = decide(inv(5000), plan, None, [])
    assert r.decision == Decision.REVIEW
    assert r.recommended_quantity_mt == D("0")


def test_no_feasible_sourcing_option_gives_review():
    plan = allocate_replenishment(D("3000"), [INTL], D("10000"), max_lead_time_days=15)
    r = decide(inv(2000), plan, COMPARISON, [])
    assert r.decision == Decision.REVIEW
    assert r.shortfall_mt == D("3000")
    assert r.rejected_alternatives


def test_blocking_data_issue_gives_review_without_forcing_a_decision():
    r = decide(None, None, None, ["No inventory record found."])
    assert r.decision == Decision.REVIEW
    assert "DATA_ISSUE" in r.triggers
    assert "No inventory record found." in r.reasoning


def test_no_consumption_history_gives_review():
    a = analyze_inventory(START, D("5000"), D("0"), [], 10, [])
    assert a.status == InventoryStatus.DATA_INSUFFICIENT
    r = decide(a, None, None, [])
    assert r.decision == Decision.REVIEW