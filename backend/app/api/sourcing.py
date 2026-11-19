from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import get_current_user
from app.core.decimal_utils import from_d128
from app.core.utils import utc_now
from app.database.connection import get_db
from app.logic.landed_cost import (
    LandedCost, compare_routes, domestic_landed_cost, international_landed_cost, to_per_mt,
)
from app.schemas.sourcing import RouteCost, SourcingCompareRequest, SourcingCompareResponse

router = APIRouter(prefix="/api/v1/sourcing", tags=["sourcing"])
STALE = timedelta(days=7)


def _route(lc: LandedCost, rate=None, source=None) -> RouteCost:
    international = lc.route == "INTERNATIONAL"
    return RouteCost(
        route=lc.route, total_per_mt=lc.total_per_mt, components=lc.components,
        missing_inputs=lc.missing_inputs, notes=lc.notes,
        assessable_value_per_mt=lc.assessable_value_per_mt,
        recoverable_taxes_excluded_per_mt=lc.recoverable_taxes_excluded_per_mt if international else None,
        exchange_rate_used=rate, exchange_rate_source=source,
    )


@router.post("/compare", response_model=SourcingCompareResponse)
def compare(body: SourcingCompareRequest, user: dict = Depends(get_current_user)):
    d, i = body.domestic, body.international
    warnings: list[str] = []

    try:
        dom = domestic_landed_cost(
            to_per_mt(d.price, d.unit.value), d.freight_per_mt, d.handling_per_mt,
            other_per_mt=d.other_per_mt, quality_adjustment_per_mt=d.quality_adjustment_per_mt)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Domestic input: {e}")

    # exchange rate: use the one supplied, otherwise the latest stored USD/INR rate
    rate, source = i.exchange_rate, (i.exchange_rate_source or "USER_INPUT")
    if rate is None:
        fx = get_db().exchange_rates.find_one({"base_currency": "USD", "quote_currency": "INR"},
                                              sort=[("observed_at", -1)])
        if fx:
            rate, source = from_d128(fx["rate"]), fx["source"]
            warnings.append(f"Exchange rate {rate} was taken from the latest stored record "
                            f"({fx['observed_at'].date()}, source {source}).")
            if utc_now() - fx["observed_at"] > STALE:
                warnings.append("The stored exchange rate is more than 7 days old.")

    if rate is None:
        intl = LandedCost("INTERNATIONAL", {}, None, ["exchange_rate"],
                          ["No exchange rate was supplied and none is stored."])
    else:
        try:
            intl = international_landed_cost(
                foreign_price_per_mt=to_per_mt(i.price, i.unit.value), exchange_rate=rate,
                incoterm=i.incoterm, freight_per_mt=i.freight_per_mt, insurance_per_mt=i.insurance_per_mt,
                customs_duty_rate=i.customs_duty_rate, port_handling_per_mt=i.port_handling_per_mt,
                inland_transport_per_mt=i.inland_transport_per_mt, other_per_mt=i.other_per_mt,
                non_recoverable_tax_rate=i.non_recoverable_tax_rate,
                recoverable_tax_rate=i.recoverable_tax_rate,
                quality_adjustment_per_mt=i.quality_adjustment_per_mt,
                exchange_rate_source=source)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=f"International input: {e}")

    cmp = compare_routes(dom, intl, body.tolerance_pct)
    warnings = cmp.warnings + warnings
    if cmp.difference_below_tolerance:
        warnings.append("The cost difference is below the tolerance: the routes are too close to call on cost alone.")

    return SourcingCompareResponse(
        domestic=_route(dom),
        international=_route(intl, rate, source if rate is not None else None),
        cheaper_route=cmp.cheaper_route,
        difference_per_mt=cmp.difference_per_mt,
        absolute_difference_per_mt=cmp.absolute_difference_per_mt,
        pct_difference_vs_domestic=cmp.pct_difference_vs_domestic,
        difference_below_tolerance=cmp.difference_below_tolerance,
        is_complete=cmp.is_complete, missing_inputs=cmp.missing_inputs, warnings=warnings,
    )