from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, model_validator

from app.schemas.market import MarketType as SourcingType  # DOMESTIC / INTERNATIONAL

MT = dict(max_digits=14, decimal_places=3)


class SupplierCreate(BaseModel):
    supplier_name: str = Field(min_length=1, max_length=100)
    sourcing_type: SourcingType
    lead_time_days: int = Field(ge=1, le=365)
    capacity_mt: Decimal = Field(gt=0, **MT)
    minimum_order_mt: Decimal = Field(gt=0, **MT)
    quality_specification: dict[str, Any] = Field(default_factory=dict)
    active: bool = True

    @model_validator(mode="after")
    def _moq(self):
        self.supplier_name = self.supplier_name.strip()
        if not self.supplier_name:
            raise ValueError("supplier_name must not be blank")
        if self.minimum_order_mt > self.capacity_mt:
            raise ValueError("minimum_order_mt cannot exceed capacity_mt")
        return self


class SupplierResponse(BaseModel):
    id: str
    supplier_name: str
    sourcing_type: str
    lead_time_days: int
    capacity_mt: Decimal
    minimum_order_mt: Decimal
    quality_specification: dict[str, Any]
    active: bool
    source: str | None