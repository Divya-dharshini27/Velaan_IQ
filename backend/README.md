# VELAAN IQ Backend

Soybean procurement decision-support API: WHEN to buy, HOW MUCH, and WHICH route (domestic or international).
Rule-based and statistical. It is not a full mathematical optimizer.

## Stack (all free)
Python 3.12, FastAPI, Pydantic, PyMongo, MongoDB Atlas (free M0), Pandas, NumPy, Statsmodels, pytest.

## Setup
1. `cd backend`
2. `python -m venv venv` then `venv\Scripts\activate`
3. `pip install -r requirements.txt`
4. Copy `.env.example` to `.env` and fill in `MONGODB_URI` and `JWT_SECRET`
   (generate one with `python -c "import secrets; print(secrets.token_urlsafe(48))"`)
5. In MongoDB Atlas, add your IP under Network Access

## Run
```
python -m app.scripts.seed        # first time: loads SIMULATED_DATA
python -m uvicorn app.main:app --reload
```
Open http://127.0.0.1:8000/docs

## Tests
```
pytest -v
```

## Data and honesty notes
- All seeded records are marked `SIMULATED_DATA`. They are not real soybean prices.
- The customs duty rate has no default: it must be supplied. The 0.05 used in demos is a placeholder.
- Decisions are rule-based. Forecasts are statistical estimates validated by backtesting.
  If Exponential Smoothing does not beat the naive baseline, the baseline is used and flagged.
- A forecast never overrides a reorder or critical-stock decision.