from datetime import date, datetime, timedelta, timezone

import numpy as np
import pytest

from app.aiml.baseline import naive_forecast
from app.aiml.evaluation import ES_MODEL, NAIVE_MODEL, Metrics, backtest, mae, mape, rmse, select_model
from app.aiml.forecasting import generate_forecast
from app.aiml.preprocessing import DataStatus, ForecastUnavailable, prepare_series

START = datetime(2026, 1, 1, tzinfo=timezone.utc)


def make_records(values, step_days=1):
    return [(START + timedelta(days=i * step_days), v) for i, v in enumerate(values)]


# ---- preparation ----
def test_duplicate_dates_detected_and_last_kept():
    recs = make_records([100.0] * 40)
    recs.append((START + timedelta(days=5), 105.0))
    ps = prepare_series(recs)
    assert ps.duplicate_dates == [date(2026, 1, 6)]
    assert len(ps.series) == 40
    assert ps.series.iloc[5] == 105.0
    assert ps.status == DataStatus.WARNING


def test_missing_dates_are_filled_and_counted():
    recs = [r for i, r in enumerate(make_records([100.0 + i for i in range(40)])) if i not in (10, 11)]
    ps = prepare_series(recs)
    assert ps.missing_filled == 2
    assert len(ps.series) == 40
    assert ps.series.iloc[10] == 109.0 and ps.series.iloc[11] == 109.0     # carried from day 9


def test_non_positive_prices_dropped():
    recs = make_records([100.0] * 40) + [(START + timedelta(days=50), -5.0),
                                         (START + timedelta(days=51), 0)]
    ps = prepare_series(recs)
    assert ps.non_positive_dropped == 2
    assert len(ps.series) == 40


def test_insufficient_observations():
    ps = prepare_series(make_records([100.0] * 10))
    assert ps.status == DataStatus.INSUFFICIENT_DATA
    assert ps.series is not None


def test_weekly_data_is_not_forecast_as_daily():
    recs = make_records([100.0 + i for i in range(20)], step_days=7)
    ps = prepare_series(recs)
    assert ps.status == DataStatus.UNSUPPORTED_FREQUENCY and ps.series is None
    with pytest.raises(ForecastUnavailable):
        generate_forecast(recs, 7)


def test_outlier_is_flagged_not_removed():
    values = [100.0] * 40
    values[20] = 150.0
    ps = prepare_series(make_records(values))
    assert date(2026, 1, 21) in ps.outlier_dates
    assert ps.series.iloc[20] == 150.0


def test_as_of_excludes_future_records():
    recs = make_records([100.0 + i * 0.1 for i in range(60)])
    cutoff = (START + timedelta(days=39)).date()
    ps = prepare_series(recs, as_of=cutoff)
    assert ps.n_observations == 40 and ps.last_date == cutoff


# ---- baseline ----
def test_naive_repeats_latest_price():
    assert list(naive_forecast(np.array([1.0, 2.0, 3.0]), 4)) == [3.0] * 4


# ---- metrics (hand calculated) ----
def test_metrics():
    a, p = np.array([10.0, 20.0]), np.array([12.0, 17.0])      # errors 2 and 3
    assert mae(a, p) == 2.5
    assert rmse(a, p) == pytest.approx(2.5495, abs=1e-3)       # sqrt((4 + 9) / 2)
    assert mape(a, p) == pytest.approx(17.5)                   # (20% + 15%) / 2


def test_mape_not_computed_for_zero_or_near_zero_actuals():
    assert mape(np.array([0.0, 10.0]), np.array([1.0, 9.0])) is None
    assert mape(np.array([1e-9, 10.0]), np.array([1.0, 9.0])) is None


# ---- chronological backtesting ----
def test_backtest_is_chronological_expanding_and_leak_free():
    values = np.arange(100, 160, dtype=float)
    seen = []

    def spy(train, steps):
        seen.append(train.copy())
        return np.full(steps, train[-1])

    res = backtest(values, 7, spy)
    lengths = [len(t) for t in seen]
    assert res is not None and res.metrics.mae > 0
    assert lengths == sorted(lengths) and len(set(lengths)) == len(lengths)
    assert all(np.array_equal(t, values[:len(t)]) for t in seen)    # training data is always a prefix
    assert max(lengths) <= len(values) - 7                          # the test window is never in training


def test_backtest_returns_none_when_history_too_short():
    assert backtest(np.arange(1, 31, dtype=float), 30, lambda t, s: np.full(s, t[-1])) is None


# ---- model selection ----
NAIVE = Metrics(mae=2.0, rmse=2.4, mape=2.0, n_forecasts=70)


def test_select_model():
    assert select_model(Metrics(1.0, 1.2, 1.0, 70), NAIVE)[0] == ES_MODEL
    assert select_model(Metrics(3.0, 3.5, 3.0, 70), NAIVE)[0] == NAIVE_MODEL      # worse than baseline
    assert select_model(Metrics(1.95, 2.35, 2.0, 70), NAIVE)[0] == NAIVE_MODEL    # only about 2.5% better
    assert select_model(Metrics(1.0, 2.5, 1.0, 70), NAIVE)[0] == NAIVE_MODEL      # better MAE, worse RMSE
    assert select_model(None, NAIVE)[0] == NAIVE_MODEL


# ---- full pipeline ----
def test_pipeline_insufficient_history_uses_baseline():
    res = generate_forecast(make_records([100.0 + i * 0.1 for i in range(10)]), 7)
    assert res.model_name == NAIVE_MODEL
    assert res.quality_status == "INSUFFICIENT_DATA"
    assert res.metrics["naive"] is None
    assert res.predicted_price == res.current_price


def test_pipeline_flat_prices_fall_back_to_baseline():
    res = generate_forecast(make_records([100.0] * 120), 7)
    assert res.model_name == NAIVE_MODEL
    assert res.quality_status == "BASELINE_FALLBACK"
    assert res.predicted_price == 100.0
    assert res.direction == "FLAT"


def test_pipeline_trending_prices_select_exponential_smoothing():
    values = [100 + 2 * i + 0.5 * np.sin(i) for i in range(120)]
    res = generate_forecast(make_records(values), 7)
    assert res.model_name == ES_MODEL
    assert res.quality_status == "VALID"
    assert res.direction == "UP" and res.predicted_price > res.current_price
    assert res.metrics["exponential_smoothing"]["mae"] < res.metrics["naive"]["mae"]
    assert res.training_data_end == (START + timedelta(days=119)).date()
    assert res.lower_bound is None and res.upper_bound is None     # no invented intervals
    assert len(res.points) == 7


def test_unsupported_horizon_rejected():
    with pytest.raises(ValueError):
        generate_forecast(make_records([100.0] * 60), 10)