"""Replenishment engine. Pure functions: no database, no FastAPI.

Planning-horizon definition (explicit, as the blueprint requires):
  target position = avg daily demand x (lead time + planning horizon days)
                    + safety stock + strategic stock
  required        = max(0, target position - current inventory position)

Storage convention (conservative): free storage = capacity - physical stock on hand - incoming orders.
Reserved stock still occupies space, and consumption during the lead time is not credited.

Allocation: suppliers are used cheapest landed cost first. Each one is limited by its capacity,
the remaining storage and the remaining budget, and must satisfy its minimum order quantity (MOQ).
A shortfall is reported, never hidden.
"""
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
from enum import Enum

ZERO = Decimal("0")
Q2 = Decimal("0.01")
Q3 = Decimal("0.001")


class ReplenishmentStatus(str, Enum):
    NOT_REQUIRED = "NOT_REQUIRED"
    FULL = "FULL"                    # the whole requirement can be bought
    PARTIAL = "PARTIAL"              # some can be bought, a shortfall remains
    NONE_FEASIBLE = "NONE_FEASIBLE"  # nothing can be bought within the constraints


@dataclass(frozen=True)
class SourcingOption:
    supplier_id: str
    supplier_name: str
    route: str                               # DOMESTIC / INTERNATIONAL
    landed_cost_per_mt: Decimal | None       # None = landed cost incomplete
    capacity_mt: Decimal
    minimum_order_mt: Decimal
    lead_time_days: int


@dataclass
class Allocation:
    supplier_id: str
    supplier_name: str
    route: str
    quantity_mt: Decimal
    landed_cost_per_mt: Decimal
    total_cost_inr: Decimal
    lead_time_days: int
    notes: list[str] = field(default_factory=list)


@dataclass
class ReplenishmentPlan:
    status: ReplenishmentStatus
    required_mt: Decimal
    recommended_mt: Decimal
    shortfall_mt: Decimal
    total_cost_inr: Decimal
    allocations: list[Allocation]
    rejected: list[str]
    limiting_factors: list[str]


def q3_down(x: Decimal) -> Decimal:
    return x.quantize(Q3, rounding=ROUND_DOWN)   # never round up past a limit


def q3(x: Decimal) -> Decimal:
    return x.quantize(Q3, rounding=ROUND_HALF_UP)


# ---------- 8.3 how much ----------
def target_inventory_position(
    avg_daily_mt: Decimal,
    lead_time_days: int,
    planning_horizon_days: int,
    safety_stock_mt: Decimal,
    strategic_stock_mt: Decimal = ZERO,
) -> Decimal:
    if avg_daily_mt < 0 or safety_stock_mt < 0 or strategic_stock_mt < 0:
        raise ValueError("demand and stock values cannot be negative")
    if lead_time_days <= 0 or planning_horizon_days < 0:
        raise ValueError("lead_time_days must be positive and planning_horizon_days cannot be negative")
    return q3(avg_daily_mt * (lead_time_days + planning_horizon_days) + safety_stock_mt + strategic_stock_mt)


def required_quantity(target_position_mt: Decimal, current_position_mt: Decimal) -> Decimal:
    return q3(max(ZERO, target_position_mt - current_position_mt))


def free_storage(capacity_mt: Decimal, physical_on_hand_mt: Decimal, incoming_mt: Decimal) -> Decimal:
    if capacity_mt <= 0:
        raise ValueError("storage capacity must be greater than zero")
    return q3(max(ZERO, capacity_mt - physical_on_hand_mt - incoming_mt))


# ---------- 8.3 / 8.4 allocation ----------
def allocate_replenishment(
    required_mt: Decimal,
    options: list[SourcingOption],
    free_storage_mt: Decimal,
    budget_inr: Decimal | None = None,
    max_lead_time_days: int | None = None,
) -> ReplenishmentPlan:
    """max_lead_time_days: if set (urgent need), options that deliver later are excluded."""
    if required_mt <= 0:
        return ReplenishmentPlan(ReplenishmentStatus.NOT_REQUIRED, ZERO, ZERO, ZERO, ZERO, [], [], [])

    rejected: list[str] = []
    usable: list[SourcingOption] = []
    for o in options:
        if o.landed_cost_per_mt is None or o.landed_cost_per_mt <= 0:
            rejected.append(f"{o.supplier_name}: landed cost is unavailable or incomplete.")
        elif max_lead_time_days is not None and o.lead_time_days > max_lead_time_days:
            rejected.append(f"{o.supplier_name}: lead time {o.lead_time_days} days is later than "
                            f"the {max_lead_time_days} days available.")
        else:
            usable.append(o)
    usable.sort(key=lambda o: o.landed_cost_per_mt)

    need = required_mt
    storage_left = free_storage_mt
    budget_left = budget_inr
    allocations: list[Allocation] = []
    limiting: list[str] = []

    for o in usable:
        if need <= 0:
            break
        limits = {"supplier capacity": o.capacity_mt, "storage space": storage_left}
        if budget_left is not None:
            limits["budget"] = q3_down(budget_left / o.landed_cost_per_mt)
        limit_name = min(limits, key=limits.get)
        cap = q3_down(limits[limit_name])

        if cap < o.minimum_order_mt:
            rejected.append(f"{o.supplier_name}: cannot meet the minimum order of {o.minimum_order_mt} MT "
                            f"(limited by {limit_name} to {cap} MT).")
            if limit_name not in limiting:
                limiting.append(limit_name)
            continue

        qty = q3_down(min(max(need, o.minimum_order_mt), cap))
        notes = []
        if qty > need:
            notes.append("Quantity raised to the supplier's minimum order.")
        if qty == cap and cap < max(need, o.minimum_order_mt):
            notes.append(f"Quantity limited by {limit_name}.")
            if limit_name not in limiting:
                limiting.append(limit_name)

        cost = (qty * o.landed_cost_per_mt).quantize(Q2, rounding=ROUND_HALF_UP)
        allocations.append(Allocation(o.supplier_id, o.supplier_name, o.route, qty,
                                      o.landed_cost_per_mt, cost, o.lead_time_days, notes))
        need = max(ZERO, need - qty)
        storage_left -= qty
        if budget_left is not None:
            budget_left -= cost

    total = q3(sum((a.quantity_mt for a in allocations), ZERO))
    total_cost = sum((a.total_cost_inr for a in allocations), ZERO)
    shortfall = q3(max(ZERO, required_mt - total))

    if total == 0:
        status = ReplenishmentStatus.NONE_FEASIBLE
    elif shortfall > 0:
        status = ReplenishmentStatus.PARTIAL
    else:
        status = ReplenishmentStatus.FULL

    return ReplenishmentPlan(status, q3(required_mt), total, shortfall, total_cost,
                             allocations, rejected, limiting)