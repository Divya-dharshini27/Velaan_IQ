from decimal import Decimal

from pydantic import BaseModel, Field

from app.logic.landed_cost import Incoterm
from app.schemas.market import Unit


class DomesticQuote(BaseModel):
    price: Decimal = Field(gt=0)                       # INR per <unit>
    unit: Unit = Unit.MT
    freight_per_mt: Decimal | None = Field(default=None, ge=0)
    handling_per_mt: Decimal | None = Field(default=None, ge=0)
    other_per_mt: Decimal = Field(default=Decimal("0"), ge=0)
    quality_adjustment_per_mt: Decimal = Field(default=Decimal("0"), ge=0)


class InternationalQuote(BaseModel):
    price: Decimal = Field(gt=0)                       # USD per <unit>
    unit: Unit = Unit.MT
    incoterm: Incoterm                                 # what the quoted price already includes
    exchange_rate: Decimal | None = Field(default=None, gt=0)   # USD/INR; if empty, the latest stored rate is used
    exchange_rate_source: str | None = None
    freight_per_mt: Decimal | None = Field(default=None, ge=0)       # INR per MT
    insurance_per_mt: Decimal | None = Field(default=None, ge=0)     # INR per MT
    customs_duty_rate: Decimal | None = Field(default=None, ge=0, le=1)   # fraction, 0.05 = 5%. No default.
    port_handling_per_mt: Decimal | None = Field(default=None, ge=0)
    inland_transport_per_mt: Decimal | None = Field(default=None, ge=0)
    other_per_mt: Decimal = Field(default=Decimal("0"), ge=0)
    non_recoverable_tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=1)
    recoverable_tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=1)
    quality_adjustment_per_mt: Decimal = Field(default=Decimal("0"), ge=0)


class SourcingCompareRequest(BaseModel):
    domestic: DomesticQuote
    international: InternationalQuote
    tolerance_pct: Decimal = Field(default=Decimal("1"), ge=0, le=100)   # smaller gaps are flagged as too close to call


class RouteCost(BaseModel):
    route: str
    total_per_mt: Decimal | None
    components: dict[str, Decimal]
    missing_inputs: list[str]
    notes: list[str]
    assessable_value_per_mt: Decimal | None = None
    recoverable_taxes_excluded_per_mt: Decimal | None = None
    exchange_rate_used: Decimal | None = None
    exchange_rate_source: str | None = None


class SourcingCompareResponse(BaseModel):
    domestic: RouteCost
    international: RouteCost
    cheaper_route: str | None
    difference_per_mt: Decimal | None            # international minus domestic (negative = international cheaper)
    absolute_difference_per_mt: Decimal | None
    pct_difference_vs_domestic: Decimal | None
    difference_below_tolerance: bool | None
    is_complete: bool
    missing_inputs: list[str]
    warnings: list[str]