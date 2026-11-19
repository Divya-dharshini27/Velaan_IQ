from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import HTTPException

from app.aiml.forecasting import MODEL_VERSION, generate_forecast
from app.aiml.preprocessing import ForecastUnavailable
from app.core.decimal_utils import from_d128, to_d128
from app.core.utils import utc_now
from app.schemas.forecast import (
    ForecastEvaluationResponse, ForecastPoint, ForecastResponse, ForecastRunSummary,
)

COMMODITY = "SOYBEAN"


def _day(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


def _money(x: float) -> Decimal:
    return to_d128(Decimal(str(round(x, 2))).quantize(Decimal("0.01")))


def to_response(doc: dict, cached: bool = False) -> ForecastResponse:
    return ForecastResponse(
        id=str(doc["_id"]),
        commodity=doc["commodity"],
        market_type=doc["market_type"],
        market_name=doc["market_name"],
        currency=doc["currency"],
        unit=doc["unit"],
        horizon_days=doc["horizon_days"],
        forecast_date=doc["forecast_date"],
        target_date=doc["target_date"].date(),
        current_price=from_d128(doc["current_price"]),
        current_price_date=doc["current_price_date"].date(),
        predicted_price=from_d128(doc["predicted_price"]),
        expected_change_pct=doc["expected_change_pct"],
        direction=doc["direction"],
        lower_bound=from_d128(doc["lower_bound"]) if doc.get("lower_bound") is not None else None,
        upper_bound=from_d128(doc["upper_bound"]) if doc.get("upper_bound") is not None else None,
        model_name=doc["model_name"],
        model_version=doc["model_version"],
        training_data_start=doc["training_data_start"].date(),
        training_data_end=doc["training_data_end"].date(),
        quality_status=doc["quality_status"],
        data_quality_status=doc["data_quality_status"],
        selection_reason=doc["selection_reason"],
        backtest_metrics=doc["metrics"],
        points=[ForecastPoint(target_date=p["date"].date(), predicted_price=from_d128(p["price"]))
                for p in doc["points"]],
        warnings=doc.get("warnings", []),
        cached=cached,
        created_at=doc["created_at"],
    )


def generate_and_store(db, market_type: str, horizon_days: int, market_name: str | None,
                       force: bool, user_id: str) -> tuple[dict, bool]:
    # 1. resolve ONE market and ONE currency, so prices are never mixed
    query = {"commodity": COMMODITY, "market_type": market_type}
    if market_name:
        query["market_name"] = market_name.strip()
    latest = db.market_prices.find_one(query, sort=[("observed_at", -1)])
    if not latest:
        raise HTTPException(status_code=404, detail="No market prices found for this market")

    scope = {"commodity": COMMODITY, "market_type": market_type,
             "market_name": latest["market_name"], "currency": latest["currency"]}
    last_day = _day(latest["observed_at"].date())

    # 2. cache: reuse the stored forecast unless new price data has arrived (or force=True)
    if not force:
        cached = db.forecasts.find_one(
            {**scope, "horizon_days": horizon_days, "training_data_end": last_day,
             "model_version": MODEL_VERSION},
            sort=[("created_at", -1)],
        )
        if cached:
            return cached, True

    # 3. load history (kept in full, spikes included) and run the pipeline
    cursor = db.market_prices.find(scope, {"observed_at": 1, "price_per_mt": 1}).sort("observed_at", 1)
    records = [(d["observed_at"], float(from_d128(d["price_per_mt"]))) for d in cursor]
    try:
        result = generate_forecast(records, horizon_days)
    except ForecastUnavailable as exc:
        raise HTTPException(status_code=422, detail=f"Forecast not possible: {exc}")

    # 4. store with full model metadata (blueprint: never an unstructured calculation)
    now = utc_now()
    doc = {
        **scope,
        "unit": "MT",
        "horizon_days": horizon_days,
        "forecast_date": now,
        "target_date": _day(result.points[-1][0]),
        "current_price": _money(result.current_price),
        "current_price_date": _day(result.current_price_date),
        "predicted_price": _money(result.predicted_price),
        "lower_bound": None,      # the model provides no interval, so none is invented
        "upper_bound": None,
        "expected_change_pct": result.expected_change_pct,
        "direction": result.direction,
        "model_name": result.model_name,
        "model_version": result.model_version,
        "training_data_start": _day(result.training_data_start),
        "training_data_end": _day(result.training_data_end),
        "quality_status": result.quality_status,
        "data_quality_status": result.data_quality_status,
        "selection_reason": result.selection_reason,
        "metrics": result.metrics,
        "points": [{"date": _day(d), "price": _money(p)} for d, p in result.points],
        "warnings": result.warnings,
        "created_by": user_id,
        "created_at": now,
    }
    doc["_id"] = db.forecasts.insert_one(doc).inserted_id
    return doc, False


def _latest_doc(db, market_type: str, horizon_days: int, market_name: str | None) -> dict:
    query = {"commodity": COMMODITY, "market_type": market_type, "horizon_days": horizon_days}
    if market_name:
        query["market_name"] = market_name.strip()
    doc = db.forecasts.find_one(query, sort=[("created_at", -1)])
    if not doc:
        raise HTTPException(status_code=404,
                            detail="No forecast found. Create one with POST /api/v1/forecast/generate")
    return doc


def get_latest(db, market_type: str, horizon_days: int, market_name: str | None) -> ForecastResponse:
    return to_response(_latest_doc(db, market_type, horizon_days, market_name), cached=True)


def _improvement(naive: dict | None, es: dict | None, key: str) -> float | None:
    if not naive or not es or not naive.get(key):
        return None
    return round((naive[key] - es[key]) / naive[key] * 100, 2)


def get_evaluation(db, market_type: str, horizon_days: int,
                   market_name: str | None) -> ForecastEvaluationResponse:
    doc = _latest_doc(db, market_type, horizon_days, market_name)
    history = db.forecasts.find(
        {"commodity": COMMODITY, "market_type": market_type, "horizon_days": horizon_days,
         "market_name": doc["market_name"]}
    ).sort("created_at", -1).limit(10)

    m = doc["metrics"]
    es, naive = m.get("exponential_smoothing"), m.get("naive")
    return ForecastEvaluationResponse(
        forecast_id=str(doc["_id"]),
        market_type=doc["market_type"],
        market_name=doc["market_name"],
        horizon_days=doc["horizon_days"],
        model_name=doc["model_name"],
        model_version=doc["model_version"],
        quality_status=doc["quality_status"],
        data_quality_status=doc["data_quality_status"],
        selection_reason=doc["selection_reason"],
        training_data_start=doc["training_data_start"].date(),
        training_data_end=doc["training_data_end"].date(),
        backtest_origins=m.get("n_origins", 0),
        exponential_smoothing=es,
        naive=naive,
        mae_improvement_pct=_improvement(naive, es, "mae"),
        rmse_improvement_pct=_improvement(naive, es, "rmse"),
        created_at=doc["created_at"],
        history=[ForecastRunSummary(id=str(h["_id"]), created_at=h["created_at"],
                                    model_name=h["model_name"], quality_status=h["quality_status"],
                                    training_data_end=h["training_data_end"].date())
                 for h in history],
    )