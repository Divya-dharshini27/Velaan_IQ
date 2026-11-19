from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.utils import past_utc
from app.schemas.market import Currency


class ExchangeRateCreate(BaseModel):
    base_currency: Currency
    quote_currency: Currency
    rate: Decimal = Field(gt=0, max_digits=12, decimal_places=6)
    observed_at: datetime
    source: str = Field(min_length=1, max_length=100)

    @field_validator("observed_at")
    @classmethod
    def _utc(cls, v):
        return past_utc(v)

    @model_validator(mode="after")
    def _different(self):
        if self.base_currency == self.quote_currency:
            raise ValueError("base_currency and quote_currency must differ")
        return self


class ExchangeRateResponse(BaseModel):
    id: str
    base_currency: str
    quote_currency: str
    rate: Decimal
    observed_at: datetime
    source: str
    data_quality_status: str