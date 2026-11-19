from datetime import datetime, timedelta, timezone
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field, field_validator


class MarketType(str, Enum):
    DOMESTIC = "DOMESTIC"
    INTERNATIONAL = "INTERNATIONAL"


class Unit(str, Enum):
    MT = "MT"
    QUINTAL = "QUINTAL"
    KG = "KG"


class Currency(str, Enum):
    INR = "INR"
    USD = "USD"


class MarketPriceCreate(BaseModel):
    commodity: str = "SOYBEAN"
    market_type: MarketType
    market_name: str = Field(min_length=1, max_length=100)
    price: Decimal = Field(gt=0, max_digits=14, decimal_places=4)
    currency: Currency
    unit: Unit
    observed_at: datetime
    source: str = Field(min_length=1, max_length=100)
    quality_grade: str | None = None

    @field_validator("commodity", "market_name", "source")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("observed_at")
    @classmethod
    def _to_utc(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        v = v.astimezone(timezone.utc)
        if v > datetime.now(timezone.utc) + timedelta(days=1):
            raise ValueError("observed_at cannot be in the future")
        return v


class MarketPriceResponse(BaseModel):
    id: str
    commodity: str
    market_type: str
    market_name: str
    price: Decimal
    currency: str
    unit: str
    price_per_mt: Decimal
    observed_at: datetime
    source: str
    quality_grade: str | None
    data_quality_status: str
    created_at: datetime


class MarketPricePage(BaseModel):
    items: list[MarketPriceResponse]
    total: int
    page: int
    page_size: int


class UploadRowError(BaseModel):
    row: int
    error: str


class UploadResult(BaseModel):
    filename: str
    total_rows: int
    inserted: int
    duplicates: int
    flagged_unusual: int
    rejected: int
    errors: list[UploadRowError]


class MarketSummaryItem(BaseModel):
    market_type: str
    market_name: str
    currency: str
    latest_price_per_mt: Decimal
    latest_observed_at: datetime
    change_7d_pct: Decimal | None
    change_30d_pct: Decimal | None
    min_30d: Decimal
    max_30d: Decimal
    avg_30d: Decimal
    records_30d: int
    flagged_records_30d: int
    data_quality_status: str


class MarketSummary(BaseModel):
    as_of: datetime
    items: list[MarketSummaryItem]