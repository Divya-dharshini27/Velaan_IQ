import numpy as np


def naive_forecast(values, steps: int) -> np.ndarray:
    """Future price = latest observed price. The benchmark every other model must beat."""
    values = np.asarray(values, dtype=float)
    if len(values) == 0:
        raise ValueError("values must not be empty")
    if steps <= 0:
        raise ValueError("steps must be positive")
    return np.full(steps, values[-1])