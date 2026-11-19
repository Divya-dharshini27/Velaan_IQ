"""Forecast orchestration: prepare -> backtest -> select -> forecast.
Prices are handled as floats inside this module. Convert to Decimal when storing results.

Exponential Smoothing choices (MVP):
- Level always; a DAMPED trend only when there are at least MIN_OBS_FOR_TREND observations.
- No seasonal component: daily commodity data needs several complete cycles to justify one.
- No confidence intervals: this model does not provide them, so none are invented.
"""
import warnings as _warnings
from dataclasses import dataclass, field
from datetime import date, timedelta

import numpy as np

from app.aiml.baseline import naive_forecast
from app.aiml.evaluation import ES_MODEL, NAIVE_MODEL, backtest, select_model
from app.aiml.preprocessing import DataStatus, ForecastUnavailable, prepare_series

MODEL_VERSION = "1.0"
SUPPORTED_HORIZONS = (7, 30)
MIN_OBS_FOR_TREND = 60
DIRECTION_THRESHOLD_PCT = 0.5


@dataclass
class ForecastResult:
    horizon_days: int
    current_price: float
    current_price_date: date
    predicted_price: float
    expected_change_pct: float
    direction: str                          # UP / DOWN / FLAT
    model_name: str
    model_version: str
    training_data_start: date
    training_data_end: date
    quality_status: str                     # VALID / BASELINE_FALLBACK / INSUFFICIENT_DATA
    data_quality_status: str
    selection_reason: str
    metrics: dict
    points: list[tuple[date, float]]
    lower_bound: float | None = None
    upper_bound: float | None = None
    warnings: list[str] = field(default_factory=list)


def exp_smoothing_forecast(train, steps: int, use_trend: bool | None = None) -> np.ndarray:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    train = np.asarray(train, dtype=float)
    if use_trend is None:
        use_trend = len(train) >= MIN_OBS_FOR_TREND
    with _warnings.catch_warnings():
        _warnings.simplefilter("ignore")
        model = ExponentialSmoothing(
            train,
            trend="add" if use_trend else None,
            damped_trend=use_trend,
            seasonal=None,
            initialization_method="estimated",
        )
        out = np.asarray(model.fit().forecast(steps), dtype=float)
    if not np.all(np.isfinite(out)) or np.any(out <= 0):
        raise ValueError("model produced an invalid (non-finite or non-positive) forecast")
    return out


def _direction(change_pct: float) -> str:
    if change_pct > DIRECTION_THRESHOLD_PCT:
        return "UP"
    if change_pct < -DIRECTION_THRESHOLD_PCT:
        return "DOWN"
    return "FLAT"


def generate_forecast(records, horizon_days: int, as_of: date | None = None) -> ForecastResult:
    """records: iterable of (datetime, price) for ONE market and ONE currency."""
    if horizon_days not in SUPPORTED_HORIZONS:
        raise ValueError(f"horizon_days must be one of {SUPPORTED_HORIZONS}")

    prepared = prepare_series(records, as_of)
    if prepared.series is None:
        raise ForecastUnavailable("; ".join(prepared.warnings) or "No usable price data.")

    values = prepared.series.to_numpy(dtype=float)
    current = float(values[-1])
    warnings = list(prepared.warnings)
    es_metrics = naive_metrics = None
    n_origins = 0
    model = NAIVE_MODEL

    if prepared.status == DataStatus.INSUFFICIENT_DATA:
        quality = "INSUFFICIENT_DATA"
        reason = "Not enough reliable history to validate a model: the naive baseline is shown."
    else:
        naive_bt = backtest(values, horizon_days, naive_forecast)
        if naive_bt is None:
            quality = "INSUFFICIENT_DATA"
            reason = f"History is too short to backtest a {horizon_days}-day forecast: the naive baseline is shown."
        else:
            naive_metrics, n_origins = naive_bt.metrics, naive_bt.n_origins
            try:
                es_metrics = backtest(values, horizon_days, exp_smoothing_forecast).metrics
            except Exception as exc:   # any model failure means "not validated", never a crash
                warnings.append(f"Exponential Smoothing backtest failed ({type(exc).__name__}).")
            model, reason = select_model(es_metrics, naive_metrics)
            quality = "VALID" if model == ES_MODEL else "BASELINE_FALLBACK"

    predictions = naive_forecast(values, horizon_days)
    if model == ES_MODEL:
        try:
            predictions = exp_smoothing_forecast(values, horizon_days)
        except Exception as exc:
            model, quality = NAIVE_MODEL, "BASELINE_FALLBACK"
            reason = "Exponential Smoothing failed on the final fit: the naive baseline is used."
            warnings.append(f"Final model fit failed ({type(exc).__name__}).")

    predicted = float(predictions[-1])
    change_pct = (predicted - current) / current * 100
    last_date = prepared.last_date
    points = [(last_date + timedelta(days=i + 1), float(p)) for i, p in enumerate(predictions)]

    return ForecastResult(
        horizon_days=horizon_days,
        current_price=current,
        current_price_date=last_date,
        predicted_price=predicted,
        expected_change_pct=round(change_pct, 2),
        direction=_direction(change_pct),
        model_name=model,
        model_version=MODEL_VERSION,
        training_data_start=prepared.first_date,
        training_data_end=last_date,
        quality_status=quality,
        data_quality_status=prepared.status.value,
        selection_reason=reason,
        metrics={
            "exponential_smoothing": es_metrics.as_dict() if es_metrics else None,
            "naive": naive_metrics.as_dict() if naive_metrics else None,
            "n_origins": n_origins,
        },
        points=points,
        warnings=warnings,
    )