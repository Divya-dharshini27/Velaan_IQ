from typing import Literal

from fastapi import APIRouter, Depends

from app.api.auth import get_current_user
from app.database.connection import get_db
from app.schemas.forecast import (
    ForecastEvaluationResponse, ForecastGenerateRequest, ForecastResponse,
)
from app.schemas.market import MarketType
from app.services import forecast_service

router = APIRouter(prefix="/api/v1/forecast", tags=["forecast"])


@router.post("/generate", response_model=ForecastResponse)
def generate(body: ForecastGenerateRequest, user: dict = Depends(get_current_user)):
    """Explicit refresh. Refits only when new price data exists (or force=true)."""
    doc, cached = forecast_service.generate_and_store(
        get_db(), body.market_type.value, body.horizon_days, body.market_name,
        body.force, str(user["_id"]),
    )
    return forecast_service.to_response(doc, cached)


@router.get("/latest", response_model=ForecastResponse)
def latest(
    market_type: MarketType = MarketType.DOMESTIC,
    horizon_days: Literal[7, 30] = 7,
    market_name: str | None = None,
    user: dict = Depends(get_current_user),
):
    """Read the most recent stored forecast. Never trains a model."""
    return forecast_service.get_latest(get_db(), market_type.value, horizon_days, market_name)


@router.get("/evaluation", response_model=ForecastEvaluationResponse)
def evaluation(
    market_type: MarketType = MarketType.DOMESTIC,
    horizon_days: Literal[7, 30] = 7,
    market_name: str | None = None,
    user: dict = Depends(get_current_user),
):
    """Backtest metrics of the latest forecast, plus the last 10 runs."""
    return forecast_service.get_evaluation(get_db(), market_type.value, horizon_days, market_name)