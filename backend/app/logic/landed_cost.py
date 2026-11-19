"""Landed-cost engine. Pure functions: no database, no FastAPI.
All outputs are INR per metric tonne (MT), as Decimal, rounded to 2 places.

Incoterms supported (what the supplier's quoted price already includes):
  FOB: neither freight nor insurance  -> both are added here
  CFR: freight included               -> only insurance is added
  CIF: freight and insurance included -> neither is added
Any freight/insurance value passed for something the quote already includes is ignored,
so it can never be counted twice.

Customs duty is charged on the assessable value (commodity + freight + insurance, i.e. the CIF value).
The duty rate is a REQUIRED input: there is no default rate. Rates used in tests are fixtures only.
Recoverable taxes are reported separately and excluded from the economic cost.
Demurrage and delay costs are NOT included: they are scenario/risk costs.
"""
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum

ZERO = Decimal("0")
Q2 = Decimal("0.01")

UNIT_TO_MT = {"MT": Decimal("1"), "QUINTAL": Decimal("10"), "KG": Decimal("1000")}


class Incoterm(str, Enum):
    FOB = "FOB"
    CFR = "CFR"
    CIF = "CIF"


@dataclass
class LandedCost:
    route: str
    components: dict[str, Decimal]
    total_per_mt: Decimal | None            # None when inputs are missing
    missing_inputs: list[str]
    notes: list[str]
    assessable_value_per_mt: Decimal | None = None
    recoverable_taxes_excluded_per_mt: Decimal = ZERO
    metadata: dict = field(default_factory=dict)   # source and effective date of inputs

    @property
    def is_complete(self) -> bool:
        return not self.missing_inputs


def q2(x: Decimal) -> Decimal:
    return x.quantize(Q2, rounding=ROUND_HALF_UP)


def to_per_mt(price: Decimal, unit: str) -> Decimal:
    """Explicit unit conversion. Unknown units are rejected, never guessed."""
    factor = UNIT_TO_MT.get(unit.upper())
    if factor is None:
        raise ValueError(f"Unsupported unit: {unit}")
    return q2(price * factor)


def _require_positive(name: str, value: Decimal | None) -> None:
    if value is None or value <= 0:
        raise ValueError(f"{name} must be greater than zero")


def _require_non_negative(**values: Decimal | None) -> None:
    for name, v in values.items():
        if v is not None and v < 0:
            raise ValueError(f"{name} cannot be negative")


def _missing(**values) -> list[str]:
    return [name for name, v in values.items() if v is None]


# ---------- 6.1 domestic ----------
def domestic_landed_cost(
    purchase_price_per_mt: Decimal,
    freight_per_mt: Decimal | None,
    handling_per_mt: Decimal | None,
    other_per_mt: Decimal = ZERO,
    quality_adjustment_per_mt: Decimal = ZERO,
    input_dates: dict[str, date] | None = None,
) -> LandedCost:
    _require_positive("purchase_price_per_mt", purchase_price_per_mt)
    _require_non_negative(freight_per_mt=freight_per_mt, handling_per_mt=handling_per_mt,
                          other_per_mt=other_per_mt, quality_adjustment_per_mt=quality_adjustment_per_mt)

    components = {"purchase_price": q2(purchase_price_per_mt)}
    missing = _missing(freight_per_mt=freight_per_mt, handling_per_mt=handling_per_mt)
    meta = {"input_dates": input_dates or {}}
    if missing:
        return LandedCost("DOMESTIC", components, None, missing,
                          ["Cost is incomplete: required inputs are missing."], metadata=meta)

    components["freight"] = q2(freight_per_mt)
    components["handling"] = q2(handling_per_mt)
    components["other_charges"] = q2(other_per_mt)
    components["quality_adjustment"] = q2(quality_adjustment_per_mt)
    return LandedCost("DOMESTIC", components, sum(components.values(), ZERO), [], [], metadata=meta)


# ---------- 6.2 international ----------
def international_landed_cost(
    foreign_price_per_mt: Decimal,
    exchange_rate: Decimal,
    incoterm: Incoterm,
    freight_per_mt: Decimal | None = None,       # INR per MT
    insurance_per_mt: Decimal | None = None,     # INR per MT
    customs_duty_rate: Decimal | None = None,    # fraction, e.g. Decimal("0.05") = 5%
    port_handling_per_mt: Decimal | None = None,
    inland_transport_per_mt: Decimal | None = None,
    other_per_mt: Decimal = ZERO,
    non_recoverable_tax_rate: Decimal = ZERO,    # fraction, charged on assessable value + duty
    recoverable_tax_rate: Decimal = ZERO,        # fraction, reported but excluded from cost
    quality_adjustment_per_mt: Decimal = ZERO,
    exchange_rate_source: str | None = None,
    input_dates: dict[str, date] | None = None,
) -> LandedCost:
    _require_positive("foreign_price_per_mt", foreign_price_per_mt)
    _require_positive("exchange_rate", exchange_rate)
    _require_non_negative(freight_per_mt=freight_per_mt, insurance_per_mt=insurance_per_mt,
                          port_handling_per_mt=port_handling_per_mt,
                          inland_transport_per_mt=inland_transport_per_mt,
                          other_per_mt=other_per_mt, quality_adjustment_per_mt=quality_adjustment_per_mt)
    for name, rate in (("customs_duty_rate", customs_duty_rate),
                       ("non_recoverable_tax_rate", non_recoverable_tax_rate),
                       ("recoverable_tax_rate", recoverable_tax_rate)):
        if rate is not None and not ZERO <= rate <= Decimal("1"):
            raise ValueError(f"{name} must be between 0 and 1 (for example 0.05 for 5%)")

    commodity = foreign_price_per_mt * exchange_rate
    components = {"commodity_cost": q2(commodity)}
    meta = {"exchange_rate": str(exchange_rate), "exchange_rate_source": exchange_rate_source,
            "incoterm": incoterm.value, "input_dates": input_dates or {}}

    # which inputs this Incoterm requires
    required = {"customs_duty_rate": customs_duty_rate,
                "port_handling_per_mt": port_handling_per_mt,
                "inland_transport_per_mt": inland_transport_per_mt}
    if incoterm == Incoterm.FOB:
        required["freight_per_mt"] = freight_per_mt
    if incoterm in (Incoterm.FOB, Incoterm.CFR):
        required["insurance_per_mt"] = insurance_per_mt
    missing = _missing(**required)
    if missing:
        return LandedCost("INTERNATIONAL", components, None, missing,
                          ["Cost is incomplete: required inputs are missing."], metadata=meta)

    notes: list[str] = []
    freight_cost = freight_per_mt if incoterm == Incoterm.FOB else ZERO
    insurance_cost = insurance_per_mt if incoterm in (Incoterm.FOB, Incoterm.CFR) else ZERO
    if incoterm != Incoterm.FOB and freight_per_mt:
        notes.append(f"{incoterm.value} price already includes freight: the freight input was ignored.")
    if incoterm == Incoterm.CIF and insurance_per_mt:
        notes.append("CIF price already includes insurance: the insurance input was ignored.")

    # assessable (CIF) value = commodity + freight + insurance, whoever pays for them under the Incoterm
    assessable = commodity + freight_cost + insurance_cost
    duty = assessable * customs_duty_rate
    tax_base = assessable + duty
    non_recoverable = tax_base * non_recoverable_tax_rate
    recoverable = tax_base * recoverable_tax_rate

    components["freight"] = q2(freight_cost)
    components["insurance"] = q2(insurance_cost)
    components["customs_duty"] = q2(duty)
    components["non_recoverable_taxes"] = q2(non_recoverable)
    components["port_handling"] = q2(port_handling_per_mt)
    components["inland_transport"] = q2(inland_transport_per_mt)
    components["other_charges"] = q2(other_per_mt)
    components["quality_adjustment"] = q2(quality_adjustment_per_mt)

    return LandedCost(
        "INTERNATIONAL", components, sum(components.values(), ZERO), [], notes,
        assessable_value_per_mt=q2(assessable),
        recoverable_taxes_excluded_per_mt=q2(recoverable),
        metadata=meta,
    )


# ---------- 6.4 comparison ----------
@dataclass
class RouteComparison:
    domestic_total_per_mt: Decimal | None
    international_total_per_mt: Decimal | None
    difference_per_mt: Decimal | None           # international minus domestic (negative = international cheaper)
    absolute_difference_per_mt: Decimal | None
    pct_difference_vs_domestic: Decimal | None
    cheaper_route: str | None                   # DOMESTIC / INTERNATIONAL / EQUAL / None when not comparable
    difference_below_tolerance: bool | None
    is_complete: bool
    missing_inputs: list[str]
    warnings: list[str]


def compare_routes(domestic: LandedCost, international: LandedCost,
                   tolerance_pct: Decimal = Decimal("1")) -> RouteComparison:
    missing = [f"domestic.{m}" for m in domestic.missing_inputs] + \
              [f"international.{m}" for m in international.missing_inputs]
    warnings = ["Cost comparison only: the cheaper route is not automatically feasible. "
                "Capacity, lead time, quality and budget are checked by the decision engine."]

    if missing or domestic.total_per_mt is None or international.total_per_mt is None:
        return RouteComparison(domestic.total_per_mt, international.total_per_mt, None, None, None,
                               None, None, False, missing,
                               warnings + ["Comparison unavailable: required inputs are missing."])

    diff = international.total_per_mt - domestic.total_per_mt
    pct = q2(diff / domestic.total_per_mt * 100)
    cheaper = "EQUAL" if diff == 0 else ("INTERNATIONAL" if diff < 0 else "DOMESTIC")
    return RouteComparison(
        domestic.total_per_mt, international.total_per_mt, q2(diff), q2(abs(diff)), pct,
        cheaper, abs(pct) < tolerance_pct, True, [], warnings,
    )