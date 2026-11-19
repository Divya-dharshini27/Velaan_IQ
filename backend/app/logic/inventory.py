"""Inventory intelligence engine. Pure functions: no database, no FastAPI.

Accounting convention (used everywhere):
  available_stock_mt = physical stock on hand
  reserved_stock_mt  = the part of that stock already committed
  usable on-hand     = available - reserved        (reserved is subtracted exactly once)
  inventory position = usable on-hand + confirmed incoming orders
"""
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from math import sqrt
from statistics import NormalDist, pstdev

ZERO = Decimal("0")
Q3 = Decimal("0.001")


class InventoryStatus(str, Enum):
    HEALTHY = "HEALTHY"
    WATCH = "WATCH"
    REORDER_REQUIRED = "REORDER_REQUIRED"
    CRITICAL = "CRITICAL"
    DATA_INSUFFICIENT = "DATA_INSUFFICIENT"


@dataclass(frozen=True)
class IncomingOrder:
    quantity_mt: Decimal
    expected_arrival: date


@dataclass(frozen=True)
class StatusThresholds:
    watch_buffer_days: Decimal = Decimal("5")   # WATCH when position is within this many days of demand above the reorder point


def q3(x: Decimal) -> Decimal:
    return x.quantize(Q3, rounding=ROUND_HALF_UP)


# ---------- 5.1 / 5.2 stock and position ----------
def net_available(available_mt: Decimal, reserved_mt: Decimal) -> Decimal:
    if available_mt < 0 or reserved_mt < 0:
        raise ValueError("stock values cannot be negative")
    if reserved_mt > available_mt:
        raise ValueError("reserved stock cannot exceed available stock")
    return available_mt - reserved_mt


def inventory_position(usable_on_hand_mt: Decimal, orders: list[IncomingOrder]) -> Decimal:
    """usable on-hand + confirmed incoming. Caller passes only CONFIRMED / IN_TRANSIT orders."""
    if usable_on_hand_mt < 0:
        raise ValueError("usable stock cannot be negative")
    return usable_on_hand_mt + sum((o.quantity_mt for o in orders), ZERO)


# ---------- 5.3 consumption ----------
def average_daily_consumption(daily_values: list[Decimal]) -> Decimal | None:
    """Average over the days that actually have a record.
    Missing days are NOT treated as zero. Returns None when there is no data."""
    if not daily_values:
        return None
    if any(v < 0 for v in daily_values):
        raise ValueError("consumption cannot be negative")
    return q3(sum(daily_values, ZERO) / len(daily_values))


def demand_std_dev(daily_values: list[Decimal]) -> Decimal | None:
    """Population std dev of daily demand; needs at least 2 observations."""
    if len(daily_values) < 2:
        return None
    return q3(Decimal(str(pstdev([float(v) for v in daily_values]))))


# ---------- 5.4 coverage ----------
def coverage_days(usable_mt: Decimal, avg_daily_mt: Decimal | None) -> Decimal | None:
    """None means 'not computable' (no data or zero consumption): never a division by zero."""
    if avg_daily_mt is None or avg_daily_mt <= 0:
        return None
    return q3(usable_mt / avg_daily_mt)


# ---------- 5.5 safety stock ----------
def safety_stock(
    service_level: float,
    avg_daily_mt: Decimal,
    lead_time_days: int,
    daily_std_mt: Decimal | None = None,
    lead_time_std_days: Decimal | None = None,
    fixed_mt: Decimal | None = None,
) -> tuple[Decimal, str]:
    """Returns (safety stock in MT, method used).
    1. fixed_mt given            -> FIXED (the configurable MVP input)
    2. variable lead time known  -> z*sqrt(L*sigma_d^2 + d^2*sigma_L^2)
    3. otherwise                 -> z*sigma_d*sqrt(L)
    """
    if fixed_mt is not None:
        if fixed_mt < 0:
            raise ValueError("fixed safety stock cannot be negative")
        return q3(fixed_mt), "FIXED"
    if not 0.5 <= service_level < 1:
        raise ValueError("service_level must be at least 0.5 and below 1")
    if lead_time_days <= 0:
        raise ValueError("lead_time_days must be positive")
    if daily_std_mt is None:
        raise ValueError("daily_std_mt or fixed_mt is required")

    z = NormalDist().inv_cdf(service_level)
    sigma_d = float(daily_std_mt)
    if lead_time_std_days is not None:
        d = float(avg_daily_mt)
        value = z * sqrt(lead_time_days * sigma_d ** 2 + d ** 2 * float(lead_time_std_days) ** 2)
        return q3(Decimal(str(value))), "VARIABLE_LEAD_TIME"
    return q3(Decimal(str(z * sigma_d * sqrt(lead_time_days)))), "CONSTANT_LEAD_TIME"


# ---------- 5.6 reorder point ----------
def reorder_point(avg_daily_mt: Decimal, lead_time_days: int, safety_stock_mt: Decimal) -> Decimal:
    return q3(avg_daily_mt * lead_time_days + safety_stock_mt)


# ---------- 5.7 stock-out simulation ----------
@dataclass
class DepletionResult:
    stock_out_date: date | None
    days_until_stock_out: int | None
    min_projected_stock_mt: Decimal
    stock_out_before_replenishment: bool
    daily_projection: list[tuple[date, Decimal]] = field(default_factory=list)


def simulate_depletion(
    start_date: date,
    usable_stock_mt: Decimal,
    avg_daily_mt: Decimal,
    orders: list[IncomingOrder],
    horizon_days: int,
) -> DepletionResult:
    """Day-by-day simulation. Each day: arrivals are added first, then consumption is deducted.
    Order dated on or before start_date arrives on day 1."""
    stock = usable_stock_mt
    minimum = stock
    stock_out_date = None
    projection = []

    for n in range(1, horizon_days + 1):
        current = date.fromordinal(start_date.toordinal() + n)
        for o in orders:
            arrival = max(o.expected_arrival, date.fromordinal(start_date.toordinal() + 1))
            if arrival == current:
                stock += o.quantity_mt
        stock -= avg_daily_mt
        projection.append((current, q3(stock)))
        minimum = min(minimum, stock)
        if stock < 0 and stock_out_date is None:
            stock_out_date = current

    days_until = (stock_out_date - start_date).days if stock_out_date else None
    return DepletionResult(
        stock_out_date=stock_out_date,
        days_until_stock_out=days_until,
        min_projected_stock_mt=q3(minimum),
        stock_out_before_replenishment=stock_out_date is not None,
        daily_projection=projection,
    )


# ---------- 5.8 status ----------
def classify_inventory(
    position_mt: Decimal | None,
    reorder_point_mt: Decimal | None,
    avg_daily_mt: Decimal | None,
    stock_out_before_replenishment: bool,
    thresholds: StatusThresholds = StatusThresholds(),
) -> InventoryStatus:
    if position_mt is None or reorder_point_mt is None or avg_daily_mt is None or avg_daily_mt <= 0:
        return InventoryStatus.DATA_INSUFFICIENT
    if stock_out_before_replenishment:
        return InventoryStatus.CRITICAL
    if position_mt <= reorder_point_mt:
        return InventoryStatus.REORDER_REQUIRED
    if position_mt <= reorder_point_mt + avg_daily_mt * thresholds.watch_buffer_days:
        return InventoryStatus.WATCH
    return InventoryStatus.HEALTHY


# ---------- one call that ties it together ----------
@dataclass
class InventoryAnalysis:
    usable_on_hand_mt: Decimal
    incoming_mt: Decimal
    inventory_position_mt: Decimal
    avg_daily_consumption_mt: Decimal | None
    coverage_days: Decimal | None
    safety_stock_mt: Decimal | None
    safety_stock_method: str | None
    reorder_point_mt: Decimal | None
    depletion: DepletionResult | None
    status: InventoryStatus
    warnings: list[str]


def analyze_inventory(
    start_date: date,
    available_mt: Decimal,
    reserved_mt: Decimal,
    consumption_history: list[Decimal],
    lead_time_days: int,
    orders: list[IncomingOrder],
    service_level: float = 0.95,
    fixed_safety_stock_mt: Decimal | None = None,
    thresholds: StatusThresholds = StatusThresholds(),
) -> InventoryAnalysis:
    warnings: list[str] = []
    usable = net_available(available_mt, reserved_mt)
    position = inventory_position(usable, orders)
    avg = average_daily_consumption(consumption_history)

    if avg is None:
        warnings.append("No consumption history: coverage and reorder point cannot be computed.")
    elif avg == 0:
        warnings.append("Average consumption is zero: coverage is not computable.")

    ss = method = rop = depletion = None
    if avg is not None and avg > 0:
        std = demand_std_dev(consumption_history)
        if fixed_safety_stock_mt is None and std is None:
            warnings.append("Not enough history for demand variability: using zero safety stock.")
            fixed_safety_stock_mt = ZERO
        ss, method = safety_stock(service_level, avg, lead_time_days, std, None, fixed_safety_stock_mt)
        rop = reorder_point(avg, lead_time_days, ss)
        # simulate until replenishment could land: the lead time, with a 30-day minimum
        depletion = simulate_depletion(start_date, usable, avg, orders, max(lead_time_days, 30))

    # critical only if stock runs out within the lead time, since no new order could arrive earlier
    critical = bool(
        depletion
        and depletion.days_until_stock_out is not None
        and depletion.days_until_stock_out <= lead_time_days
    )
    status = classify_inventory(position, rop, avg, critical, thresholds)

    return InventoryAnalysis(
        usable_on_hand_mt=usable,
        incoming_mt=position - usable,
        inventory_position_mt=position,
        avg_daily_consumption_mt=avg,
        coverage_days=coverage_days(usable, avg),
        safety_stock_mt=ss,
        safety_stock_method=method,
        reorder_point_mt=rop,
        depletion=depletion,
        status=status,
        warnings=warnings,
    )