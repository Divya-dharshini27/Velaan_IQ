from datetime import date
from decimal import Decimal as D

import pytest

from app.logic.inventory import (
    IncomingOrder, InventoryStatus, analyze_inventory, average_daily_consumption,
    classify_inventory, coverage_days, inventory_position, net_available,
    reorder_point, safety_stock, simulate_depletion,
)

START = date(2026, 11, 9)


# ---- reserved stock accounting ----
def test_net_available_subtracts_reserved_once():
    assert net_available(D("5000"), D("500")) == D("4500")      # 5000 - 500


def test_reserved_cannot_exceed_available():
    with pytest.raises(ValueError):
        net_available(D("100"), D("200"))


def test_inventory_position_adds_incoming():
    orders = [IncomingOrder(D("1000"), date(2026, 11, 15)), IncomingOrder(D("500"), date(2026, 11, 20))]
    assert inventory_position(D("4500"), orders) == D("6000")   # 4500 + 1000 + 500


# ---- consumption ----
def test_average_uses_recorded_days_only():
    assert average_daily_consumption([D("400"), D("500"), D("600")]) == D("500.000")


def test_missing_consumption_history_returns_none():
    assert average_daily_consumption([]) is None


# ---- coverage ----
def test_coverage_days():
    assert coverage_days(D("5000"), D("500")) == D("10.000")    # 5000 / 500


def test_zero_consumption_is_not_computable():
    assert coverage_days(D("5000"), D("0")) is None


def test_missing_consumption_coverage_not_computable():
    assert coverage_days(D("5000"), None) is None


# ---- safety stock and reorder point ----
def test_safety_stock_constant_lead_time():
    # z(0.95) = 1.644854 ; 1.644854 * 50 * sqrt(10) = 260.07
    value, method = safety_stock(0.95, D("500"), 10, D("50"))
    assert method == "CONSTANT_LEAD_TIME"
    assert abs(value - D("260.07")) < D("0.05")


def test_safety_stock_variable_lead_time():
    # z * sqrt(10*50^2 + 500^2 * 2^2) = 1.644854 * sqrt(25000 + 1000000) = 1.644854 * 1012.42 = 1665.3
    value, method = safety_stock(0.95, D("500"), 10, D("50"), D("2"))
    assert method == "VARIABLE_LEAD_TIME"
    assert abs(value - D("1665.3")) < D("0.5")


def test_fixed_safety_stock_overrides_method():
    value, method = safety_stock(0.95, D("500"), 10, None, None, D("1000"))
    assert (value, method) == (D("1000.000"), "FIXED")


def test_invalid_service_level_rejected():
    with pytest.raises(ValueError):
        safety_stock(1.2, D("500"), 10, D("50"))


def test_reorder_point():
    assert reorder_point(D("500"), 10, D("1000")) == D("6000.000")   # 500*10 + 1000


# ---- stock-out simulation ----
def test_incoming_order_arrives_before_stock_out():
    # 3000 stock, 500/day: without the order, stock goes negative on day 7.
    # With 3000 arriving on day 4, total supply is 6000 = 12 days of demand, so no stock-out within 10 days.
    orders = [IncomingOrder(D("3000"), date(2026, 11, 13))]
    r = simulate_depletion(START, D("3000"), D("500"), orders, 10)
    assert r.stock_out_date is None
    assert r.min_projected_stock_mt == D("1000.000")   # day 10: 3000 + 3000 - 10*500

def test_incoming_order_arrives_after_stock_out():
    # 2000 stock, 500/day -> negative on day 5 (2000 - 5*500 = -500); order lands day 10
    orders = [IncomingOrder(D("3000"), date(2026, 11, 19))]
    r = simulate_depletion(START, D("2000"), D("500"), orders, 30)
    assert r.days_until_stock_out == 5
    assert r.stock_out_before_replenishment is True


def test_no_stock_out_with_enough_stock():
    r = simulate_depletion(START, D("20000"), D("500"), [], 30)   # 30 * 500 = 15000 < 20000
    assert r.stock_out_date is None
    assert r.min_projected_stock_mt == D("5000.000")


# ---- classification and full analysis ----
def test_status_data_insufficient_without_consumption():
    assert classify_inventory(D("5000"), None, None, False) == InventoryStatus.DATA_INSUFFICIENT


def test_status_reorder_required_when_position_below_reorder_point():
    assert classify_inventory(D("5000"), D("6000"), D("500"), False) == InventoryStatus.REORDER_REQUIRED


def test_status_healthy():
    assert classify_inventory(D("20000"), D("6000"), D("500"), False) == InventoryStatus.HEALTHY


def test_analysis_inventory_below_reorder_point():
    # constant 500/day demand, std 0, fixed safety stock 1000, lead time 10
    # usable = 5000 - 0 = 5000 ; ROP = 500*10 + 1000 = 6000 ; position 5000 <= 6000
    # stock lasts 10 days = the lead time, so the stock-out day is day 11 (not inside the lead time)
    r = analyze_inventory(START, D("5000"), D("0"), [D("500")] * 30, 10, [],
                          fixed_safety_stock_mt=D("1000"))
    assert r.reorder_point_mt == D("6000.000")
    assert r.coverage_days == D("10.000")
    assert r.status == InventoryStatus.REORDER_REQUIRED


def test_analysis_critical_when_stock_out_inside_lead_time():
    # usable 2000 -> negative on day 5, lead time 10 -> no order can arrive in time
    r = analyze_inventory(START, D("2000"), D("0"), [D("500")] * 30, 10, [],
                          fixed_safety_stock_mt=D("1000"))
    assert r.status == InventoryStatus.CRITICAL


def test_analysis_reserved_stock_reduces_usable():
    r = analyze_inventory(START, D("5000"), D("1000"), [D("500")] * 30, 10, [],
                          fixed_safety_stock_mt=D("0"))
    assert r.usable_on_hand_mt == D("4000")
    assert r.coverage_days == D("8.000")


def test_analysis_with_no_consumption_history():
    r = analyze_inventory(START, D("5000"), D("0"), [], 10, [])
    assert r.status == InventoryStatus.DATA_INSUFFICIENT
    assert r.warnings