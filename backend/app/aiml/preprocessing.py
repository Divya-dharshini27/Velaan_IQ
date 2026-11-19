"""Price-series preparation. Pure functions: no database, no FastAPI.

Rules:
- Records are sorted chronologically. Non-positive or non-numeric prices are dropped and counted.
- Duplicate dates are detected and reported; the last record for that date is kept.
- Gaps are forward-filled and COUNTED, never hidden. Too many gaps make the data insufficient.
- Extreme day-to-day moves are FLAGGED as outliers, never deleted (they may be genuine spikes).
- Only daily data is supported. Weekly or monthly data is rejected rather than disaggregated.
- as_of removes any record dated after the prediction date, so no future information is used.
"""
from dataclasses import dataclass, field
from datetime import date
from enum import Enum

import numpy as np
import pandas as pd

MIN_OBSERVATIONS = 30
MAX_MISSING_FRACTION = 0.35     # share of calendar days without a record
OUTLIER_CHANGE = 0.20           # day-to-day move above 20% is flagged
MAX_MEDIAN_GAP_DAYS = 3         # larger typical gaps mean weekly/monthly data


class ForecastUnavailable(Exception):
    """Raised when no forecast can be produced at all."""


class DataStatus(str, Enum):
    VALID = "VALID"
    WARNING = "WARNING"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    UNSUPPORTED_FREQUENCY = "UNSUPPORTED_FREQUENCY"


@dataclass
class PreparedSeries:
    series: pd.Series | None            # daily prices, index = calendar dates
    status: DataStatus
    n_observations: int                 # unique valid days actually recorded
    duplicate_dates: list[date]
    missing_filled: int
    non_positive_dropped: int
    outlier_dates: list[date]
    first_date: date | None
    last_date: date | None
    warnings: list[str] = field(default_factory=list)


def prepare_series(records, as_of: date | None = None) -> PreparedSeries:
    """records: iterable of (datetime, price)."""
    warnings: list[str] = []
    rows: list[tuple[pd.Timestamp, float]] = []
    dropped = 0

    for ts, price in records:
        try:
            p = float(price)
        except (TypeError, ValueError):
            dropped += 1
            continue
        if not np.isfinite(p) or p <= 0:
            dropped += 1
            continue
        t = pd.Timestamp(ts)
        if t.tzinfo is not None:
            t = t.tz_convert("UTC").tz_localize(None)
        t = t.normalize()
        if as_of is not None and t.date() > as_of:
            continue
        rows.append((t, p))

    if dropped:
        warnings.append(f"{dropped} record(s) with missing or non-positive prices were dropped.")
    if not rows:
        return PreparedSeries(None, DataStatus.INSUFFICIENT_DATA, 0, [], 0, dropped, [],
                              None, None, warnings + ["No valid price observations."])

    df = pd.DataFrame(rows, columns=["date", "price"]).sort_values("date", kind="stable")
    duplicate_dates = sorted({t.date() for t in df.loc[df["date"].duplicated(keep=False), "date"]})
    if duplicate_dates:
        warnings.append(f"{len(duplicate_dates)} duplicate date(s) found: the last record was kept.")
    df = df.drop_duplicates("date", keep="last").reset_index(drop=True)
    first, last = df["date"].iloc[0].date(), df["date"].iloc[-1].date()

    if len(df) >= 2:
        median_gap = float(df["date"].diff().dt.days.dropna().median())
        if median_gap > MAX_MEDIAN_GAP_DAYS:
            warnings.append("Data is not daily (weekly or coarser): daily forecasts are not supported.")
            return PreparedSeries(None, DataStatus.UNSUPPORTED_FREQUENCY, len(df), duplicate_dates,
                                  0, dropped, [], first, last, warnings)

    obs = df.set_index("date")["price"]
    changes = obs.pct_change().abs()
    outliers = [t.date() for t in changes[changes > OUTLIER_CHANGE].index]
    if outliers:
        warnings.append(f"{len(outliers)} large price move(s) flagged for review (not removed).")

    full_index = pd.date_range(obs.index[0], obs.index[-1], freq="D")
    daily = obs.reindex(full_index)
    missing = int(daily.isna().sum())
    missing_fraction = missing / len(full_index)
    daily = daily.ffill()
    if missing:
        warnings.append(f"{missing} missing day(s) were forward-filled.")

    if len(df) < MIN_OBSERVATIONS:
        status = DataStatus.INSUFFICIENT_DATA
        warnings.append(f"Only {len(df)} observations: at least {MIN_OBSERVATIONS} are needed.")
    elif missing_fraction > MAX_MISSING_FRACTION:
        status = DataStatus.INSUFFICIENT_DATA
        warnings.append(f"{missing_fraction:.0%} of days are missing: too many gaps to forecast reliably.")
    elif duplicate_dates or missing or outliers or dropped:
        status = DataStatus.WARNING
    else:
        status = DataStatus.VALID

    return PreparedSeries(daily, status, len(df), duplicate_dates, missing, dropped,
                          outliers, first, last, warnings)