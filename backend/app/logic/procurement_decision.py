"""Decision rules. Pure function: no database, no FastAPI.
Priority: 1 supply continuity, 2 feasibility, 3 landed cost, 4 price timing.
A forecast is context only and can never override a reorder or critical status."""
from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum

from app.logic.inventory import InventoryAnalysis, InventoryStatus
from app.logic.landed_cost import RouteComparison
from app.logic.replenishment import ReplenishmentPlan, ReplenishmentStatus

ZERO = Decimal("0")


class Decision(str, Enum):
    BUY = "BUY"
    WAIT = "WAIT"
    REVIEW = "REVIEW"


@dataclass
class DecisionResult:
    decision: Decision
    sourcing_route: str | None
    recommended_quantity_mt: Decimal
    shortfall_mt: Decimal
    reasoning: list[str]
    triggers: list[str]
    rejected_alternatives: list[str] = field(default_factory=list)


def _review(lines, triggers, rejected=None, shortfall=ZERO):
    return DecisionResult(Decision.REVIEW, None, ZERO, shortfall, lines, triggers, rejected or [])


def decide(
    analysis: InventoryAnalysis | None,
    plan: ReplenishmentPlan | None,
    comparison: RouteComparison | None,
    blocking_issues: list[str],
    forecast_direction: str | None = None,
    forecast_valid: bool = False,
    cannot_beat_stock_out: bool = False,
) -> DecisionResult:
    if blocking_issues:
        return _review(["Essential inputs are missing or stale, so no automatic recommendation is made."]
                       + blocking_issues, ["DATA_ISSUE"])

    a = analysis
    if a is None or a.status == InventoryStatus.DATA_INSUFFICIENT:
        return _review(["Inventory cannot be assessed: consumption data is insufficient."], ["DATA_INSUFFICIENT"])

    pos, rop, cov = a.inventory_position_mt, a.reorder_point_mt, a.coverage_days

    # ---- WAIT: stock is healthy ----
    if a.status in (InventoryStatus.HEALTHY, InventoryStatus.WATCH):
        lines = [f"Inventory position {pos} MT is above the reorder point {rop} MT."]
        if cov is not None:
            lines.append(f"Usable stock covers about {cov} days of consumption.")
        if a.status == InventoryStatus.WATCH:
            lines.append("Position is close to the reorder point: monitor closely.")
        lines.append("Replenishment is not required now.")
        if forecast_valid and forecast_direction == "DOWN":
            lines.append("A validated forecast suggests lower prices, which supports waiting.")
        elif forecast_valid and forecast_direction == "UP":
            lines.append("A validated forecast suggests higher prices: review an early purchase "
                         "only if holding and financing costs justify it.")
        else:
            lines.append("The price forecast is not validated, so it was not used.")
        return DecisionResult(Decision.WAIT, None, ZERO, ZERO, lines, [a.status.value])

    # ---- reorder or critical: supply continuity first ----
    triggers = [a.status.value]
    if a.status == InventoryStatus.CRITICAL:
        days = a.depletion.days_until_stock_out if a.depletion else None
        lines = [f"Projected stock runs out in {days} days, within the supplier lead time.",
                 "Supply continuity takes priority over any forecast price movement."]
    else:
        lines = [f"Inventory position {pos} MT is at or below the reorder point {rop} MT."]
        if forecast_valid and forecast_direction == "DOWN":
            lines.append("A forecast price decrease does not justify waiting while the position is below the reorder point.")

    if plan is None or plan.status == ReplenishmentStatus.NONE_FEASIBLE:
        lines.append("No sourcing option satisfies the delivery, capacity, storage and budget constraints.")
        return _review(lines, triggers, plan.rejected if plan else [], plan.shortfall_mt if plan else ZERO)
    if plan.status == ReplenishmentStatus.NOT_REQUIRED:
        lines.append("The target position is already met: no purchase is needed.")
        return DecisionResult(Decision.WAIT, None, ZERO, ZERO, lines, triggers)

    routes = sorted({al.route for al in plan.allocations})
    route = routes[0] if len(routes) == 1 else "MIXED"
    lines.append(f"Required replenishment is {plan.required_mt} MT; recommended purchase is {plan.recommended_mt} MT.")
    for al in plan.allocations:
        lines.append(f"{al.quantity_mt} MT from {al.supplier_name} ({al.route}) at {al.landed_cost_per_mt} INR/MT, "
                     f"lead time {al.lead_time_days} days.")
    if comparison and comparison.is_complete:
        lines.append(f"Landed cost per MT: domestic {comparison.domestic_total_per_mt}, "
                     f"international {comparison.international_total_per_mt}; cheaper route: {comparison.cheaper_route}.")
        if comparison.cheaper_route in ("DOMESTIC", "INTERNATIONAL") and comparison.cheaper_route not in routes:
            lines.append("The recommended route differs from the cheapest because of capacity, lead time or storage limits.")
    if plan.shortfall_mt > 0:
        lines.append(f"Shortfall of {plan.shortfall_mt} MT remains (limits: {', '.join(plan.limiting_factors) or 'none'}): "
                     "consider staged orders or another supplier.")
    if cannot_beat_stock_out:
        lines.append("WARNING: no supplier can deliver before the projected stock-out. The fastest feasible option is "
                     "recommended and this needs urgent attention.")

    return DecisionResult(Decision.BUY, route, plan.recommended_mt, plan.shortfall_mt, lines, triggers,
                          plan.rejected)