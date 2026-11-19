from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.market import MarketType

DISCLAIMER = "Statistical estimate based on historical prices. Not a guaranteed market price."


class ForecastGenerateRequest(BaseModel):
    market_type: MarketType = MarketType.DOMESTIC
    horizon_days: Literal[7, 30] = 7
    market_name: str | None = Field(default=None, max_length=100)   # default: the market with the newest price
    force: bool = False   # True = refit even if no new price data has arrived


class ForecastPoint(BaseModel):
    target_date: date
    predicted_price: Decimal


class ForecastResponse(BaseModel):
    id: str
    commodity: str
    market_type: str
    market_name: str
    currency: str
    unit: str
    horizon_days: int
    forecast_date: datetime
    target_date: date
    current_price: Decimal
    current_price_date: date
    predicted_price: Decimal
    expected_change_pct: float
    direction: str
    lower_bound: Decimal | None
    upper_bound: Decimal | None
    model_name: str
    model_version: str
    training_data_start: date
    training_data_end: date
    quality_status: str
    data_quality_status: str
    selection_reason: str
    backtest_metrics: dict[str, Any]
    points: list[ForecastPoint]
    warnings: list[str]
    disclaimer: str = DISCLAIMER
    cached: bool
    created_at: datetime


class ForecastRunSummary(BaseModel):
    id: str
    created_at: datetime
    model_name: str
    quality_status: str
    training_data_end: date


class ForecastEvaluationResponse(BaseModel):
    forecast_id: str
    market_type: str
    market_name: str
    horizon_days: int
    model_name: str
    model_version: str
    quality_status: str
    data_quality_status: str
    selection_reason: str
    training_data_start: date
    training_data_end: date
    backtest_origins: int
    exponential_smoothing: dict[str, Any] | None
    naive: dict[str, Any] | None
    mae_improvement_pct: float | None    # positive = Exponential Smoothing was better
    rmse_improvement_pct: float | None
    created_at: datetime
    history: list[ForecastRunSummary]