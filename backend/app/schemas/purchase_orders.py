from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.utils import ensure_utc

MT = dict(max_digits=14, decimal_places=3)


class POStatus(str, Enum):
    CONFIRMED = "CONFIRMED"
    IN_TRANSIT = "IN_TRANSIT"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"


class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    quantity_mt: Decimal = Field(gt=0, **MT)
    ordered_at: datetime | None = None
    expected_arrival: datetime
    status: POStatus = POStatus.CONFIRMED
    received_quantity_mt: Decimal = Field(default=Decimal("0"), ge=0, **MT)

    @field_validator("ordered_at", "expected_arrival")
    @classmethod
    def _utc(cls, v):
        return ensure_utc(v) if v else v

    @model_validator(mode="after")
    def _checks(self):
        if self.received_quantity_mt > self.quantity_mt:
            raise ValueError("received_quantity_mt cannot exceed quantity_mt")
        if self.ordered_at and self.expected_arrival < self.ordered_at:
            raise ValueError("expected_arrival cannot be before ordered_at")
        return self


class PurchaseOrderResponse(BaseModel):
    id: str
    supplier_id: str
    supplier_name: str | None
    quantity_mt: Decimal
    ordered_at: datetime
    expected_arrival: datetime
    status: str
    received_quantity_mt: Decimal