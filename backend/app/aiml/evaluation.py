"""Metrics, chronological backtesting and model selection."""
from dataclasses import dataclass

import numpy as np

NAIVE_MODEL = "NAIVE_BASELINE"
ES_MODEL = "EXPONENTIAL_SMOOTHING"

MIN_IMPROVEMENT = 0.05    # the model must beat the baseline by at least 5% on MAE and RMSE
MIN_TRAIN = 20
MAX_ORIGINS = 15
MAPE_EPSILON = 1e-6


@dataclass(frozen=True)
class Metrics:
    mae: float
    rmse: float
    mape: float | None      # None when any actual value is zero or near zero
    n_forecasts: int

    def as_dict(self) -> dict:
        return {"mae": self.mae, "rmse": self.rmse, "mape": self.mape, "n_forecasts": self.n_forecasts}


def mae(actual: np.ndarray, predicted: np.ndarray) -> float:
    return float(np.mean(np.abs(actual - predicted)))


def rmse(actual: np.ndarray, predicted: np.ndarray) -> float:
    return float(np.sqrt(np.mean((actual - predicted) ** 2)))


def mape(actual: np.ndarray, predicted: np.ndarray) -> float | None:
    if np.any(np.abs(actual) < MAPE_EPSILON):
        return None
    return float(np.mean(np.abs((actual - predicted) / actual)) * 100)


def compute_metrics(actual: np.ndarray, predicted: np.ndarray) -> Metrics:
    return Metrics(mae(actual, predicted), rmse(actual, predicted), mape(actual, predicted), len(actual))


@dataclass(frozen=True)
class BacktestResult:
    metrics: Metrics
    n_origins: int


def backtest(values, horizon: int, forecaster, min_train: int = MIN_TRAIN,
             max_origins: int = MAX_ORIGINS) -> BacktestResult | None:
    """Rolling-origin, expanding-window backtest. No shuffling: each origin trains only on
    values[:t] and is scored on the `horizon` days that follow. Returns None when the history
    is too short for even one origin."""
    values = np.asarray(values, dtype=float)
    n = len(values)
    first = max(min_train, int(n * 0.6))
    last = n - horizon
    if last < first:
        return None

    origins = list(range(first, last + 1))
    if len(origins) > max_origins:
        picks = np.linspace(0, len(origins) - 1, max_origins).round().astype(int)
        origins = [origins[i] for i in sorted(set(picks.tolist()))]

    actuals, predictions = [], []
    for t in origins:
        pred = np.asarray(forecaster(values[:t], horizon), dtype=float)
        if pred.shape != (horizon,) or not np.all(np.isfinite(pred)):
            raise ValueError("forecaster returned an invalid forecast")
        actuals.append(values[t:t + horizon])
        predictions.append(pred)

    return BacktestResult(compute_metrics(np.concatenate(actuals), np.concatenate(predictions)),
                          len(origins))


def select_model(es: Metrics | None, naive: Metrics | None,
                 min_improvement: float = MIN_IMPROVEMENT) -> tuple[str, str]:
    """Returns (model name, reason). The advanced model is chosen only on proven out-of-sample gain."""
    if es is None or naive is None:
        return NAIVE_MODEL, "Exponential Smoothing could not be validated: the naive baseline is used."
    limit = 1 - min_improvement
    if es.mae < naive.mae * limit and es.rmse < naive.rmse * limit:
        return ES_MODEL, (f"Exponential Smoothing beat the naive baseline by at least "
                          f"{min_improvement:.0%} on both MAE and RMSE out of sample.")
    return NAIVE_MODEL, (f"Exponential Smoothing did not beat the naive baseline by at least "
                         f"{min_improvement:.0%} on both MAE and RMSE: the baseline is used.")