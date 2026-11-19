from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.utils import past_utc

MT = dict(max_digits=14, decimal_places=3)


class InventoryCreate(BaseModel):
    commodity: str = "SOYBEAN"
    available_stock_mt: Decimal = Field(ge=0, **MT)   # physical stock on hand
    reserved_stock_mt: Decimal = Field(default=Decimal("0"), ge=0, **MT)  # part of the stock above
    storage_capacity_mt: Decimal = Field(gt=0, **MT)
    as_of: datetime | None = None

    @field_validator("as_of")
    @classmethod
    def _utc(cls, v):
        return past_utc(v) if v else v

    @model_validator(mode="after")
    def _limits(self):
        if self.reserved_stock_mt > self.available_stock_mt:
            raise ValueError("reserved_stock_mt cannot exceed available_stock_mt")
        if self.available_stock_mt > self.storage_capacity_mt:
            raise ValueError("available_stock_mt cannot exceed storage_capacity_mt")
        return self


class InventoryResponse(BaseModel):
    id: str
    commodity: str
    available_stock_mt: Decimal
    reserved_stock_mt: Decimal
    net_available_stock_mt: Decimal
    storage_capacity_mt: Decimal
    free_storage_mt: Decimal
    as_of: datetime
    source: str | None


class ConsumptionCreate(BaseModel):
    date: datetime
    consumption_mt: Decimal = Field(ge=0, **MT)
    source: str = Field(default="MANUAL_ENTRY", min_length=1, max_length=100)

    @field_validator("date")
    @classmethod
    def _day(cls, v):
        return past_utc(v).replace(hour=0, minute=0, second=0, microsecond=0)


class ConsumptionResponse(BaseModel):
    id: str
    date: datetime
    consumption_mt: Decimal
    source: str | None


class ConsumptionSummary(BaseModel):
    period_start: datetime
    period_end: datetime
    days_requested: int
    recorded_days: int
    missing_days: int
    total_consumption_mt: Decimal
    average_daily_consumption_mt: Decimal | None
    data_quality_status: str