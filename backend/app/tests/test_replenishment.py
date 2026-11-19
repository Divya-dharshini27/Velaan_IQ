from decimal import Decimal as D

import pytest

from app.logic.replenishment import (
    ReplenishmentStatus as S, SourcingOption, allocate_replenishment,
    free_storage, required_quantity, target_inventory_position,
)

DOM = SourcingOption("d1", "Domestic Supplier", "DOMESTIC", D("46050"), D("5000"), D("100"), 10)
INTL = SourcingOption("i1", "Intl Supplier", "INTERNATIONAL", D("48064"), D("10000"), D("1000"), 45)


# ---- target position and requirement ----
def test_target_position():
    # 500 x (10 + 20) + 1000 = 16000
    assert target_inventory_position(D("500"), 10, 20, D("1000")) == D("16000.000")


def test_target_includes_strategic_stock():
    assert target_inventory_position(D("500"), 10, 20, D("1000"), D("2000")) == D("18000.000")


def test_required_quantity():
    assert required_quantity(D("16000"), D("5000")) == D("11000.000")


def test_no_requirement_when_position_above_target():
    assert required_quantity(D("16000"), D("20000")) == D("0.000")
    plan = allocate_replenishment(D("0"), [DOM], D("9000"))
    assert plan.status == S.NOT_REQUIRED and plan.allocations == []


def test_free_storage_counts_physical_stock_and_incoming():
    assert free_storage(D("15000"), D("5000"), D("1000")) == D("9000.000")   # 15000 - 5000 - 1000


def test_free_storage_never_negative():
    assert free_storage(D("15000"), D("14000"), D("3000")) == D("0.000")


# ---- allocation ----
def test_single_supplier_capacity_causes_shortfall():
    plan = allocate_replenishment(D("11000"), [DOM], D("20000"))
    assert plan.recommended_mt == D("5000.000")        # domestic capacity
    assert plan.shortfall_mt == D("6000.000")          # 11000 - 5000
    assert plan.status == S.PARTIAL
    assert "supplier capacity" in plan.limiting_factors


def test_two_suppliers_cover_the_full_requirement():
    plan = allocate_replenishment(D("11000"), [DOM, INTL], D("20000"))
    assert [a.supplier_id for a in plan.allocations] == ["d1", "i1"]
    assert plan.allocations[0].quantity_mt == D("5000.000")
    assert plan.allocations[1].quantity_mt == D("6000.000")
    assert plan.status == S.FULL and plan.shortfall_mt == D("0.000")
    # 5000 x 46050 = 230,250,000 ; 6000 x 48064 = 288,384,000
    assert plan.total_cost_inr == D("518634000.00")


def test_cheapest_route_is_used_first():
    cheap_intl = SourcingOption("i1", "Intl Supplier", "INTERNATIONAL", D("44000"), D("10000"), D("1000"), 45)
    plan = allocate_replenishment(D("11000"), [DOM, cheap_intl], D("20000"))
    assert plan.allocations[0].supplier_id == "i1"
    assert plan.allocations[0].quantity_mt == D("10000.000")
    assert plan.allocations[1].quantity_mt == D("1000.000")


def test_storage_constraint_limits_quantity():
    plan = allocate_replenishment(D("11000"), [DOM, INTL], D("3000"))
    assert plan.recommended_mt == D("3000.000")
    assert plan.shortfall_mt == D("8000.000")
    assert "storage space" in plan.limiting_factors
    assert any("Intl Supplier" in r for r in plan.rejected)   # nothing left for the second supplier


def test_budget_constraint_limits_quantity():
    # 46,050,000 / 46,050 = exactly 1000 MT
    plan = allocate_replenishment(D("5000"), [DOM], D("20000"), budget_inr=D("46050000"))
    assert plan.recommended_mt == D("1000.000")
    assert plan.shortfall_mt == D("4000.000")
    assert "budget" in plan.limiting_factors


def test_quantity_below_moq_is_raised_to_moq():
    plan = allocate_replenishment(D("50"), [DOM], D("20000"))
    assert plan.recommended_mt == D("100.000")
    assert plan.shortfall_mt == D("0.000")
    assert any("minimum order" in n for n in plan.allocations[0].notes)


def test_moq_cannot_be_met_within_storage():
    plan = allocate_replenishment(D("50"), [DOM], D("80"))      # only 80 MT of space, MOQ is 100
    assert plan.status == S.NONE_FEASIBLE
    assert plan.recommended_mt == D("0.000")
    assert plan.shortfall_mt == D("50.000")


# ---- feasibility ----
def test_slow_route_excluded_when_stock_is_urgent():
    plan = allocate_replenishment(D("3000"), [DOM, INTL], D("20000"), max_lead_time_days=15)
    assert [a.supplier_id for a in plan.allocations] == ["d1"]
    assert any("lead time" in r for r in plan.rejected)


def test_no_feasible_option():
    plan = allocate_replenishment(D("3000"), [INTL], D("20000"), max_lead_time_days=15)
    assert plan.status == S.NONE_FEASIBLE
    assert plan.shortfall_mt == D("3000.000")


def test_option_with_missing_landed_cost_is_not_used():
    unknown = SourcingOption("x1", "No Quote Supplier", "DOMESTIC", None, D("5000"), D("100"), 7)
    plan = allocate_replenishment(D("1000"), [unknown, DOM], D("20000"))
    assert [a.supplier_id for a in plan.allocations] == ["d1"]
    assert any("No Quote Supplier" in r for r in plan.rejected)


def test_never_exceeds_supplier_capacity_or_storage():
    plan = allocate_replenishment(D("100000"), [DOM, INTL], D("12000"))
    assert plan.recommended_mt <= D("12000")
    for a in plan.allocations:
        assert a.quantity_mt <= D("10000")


def test_invalid_inputs_rejected():
    with pytest.raises(ValueError):
        target_inventory_position(D("500"), 0, 20, D("1000"))
    with pytest.raises(ValueError):
        free_storage(D("0"), D("0"), D("0"))