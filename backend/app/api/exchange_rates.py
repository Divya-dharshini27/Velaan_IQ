from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import get_current_user
from app.core.decimal_utils import from_d128, to_d128
from app.core.utils import utc_now
from app.database.connection import get_db
from app.schemas.common import Page
from app.schemas.exchange_rates import ExchangeRateCreate, ExchangeRateResponse
from app.schemas.market import Currency

router = APIRouter(prefix="/api/v1/exchange-rates", tags=["exchange-rates"])
UNUSUAL_CHANGE = Decimal("0.05")  # flag moves above 5% versus the previous record


def _to_response(doc: dict) -> ExchangeRateResponse:
    return ExchangeRateResponse(
        id=str(doc["_id"]),
        base_currency=doc["base_currency"],
        quote_currency=doc["quote_currency"],
        rate=from_d128(doc["rate"]),
        observed_at=doc["observed_at"],
        source=doc["source"],
        data_quality_status=doc.get("data_quality_status", "VALID"),
    )


@router.post("", response_model=ExchangeRateResponse, status_code=201)
def create_rate(body: ExchangeRateCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    pair = {"base_currency": body.base_currency.value, "quote_currency": body.quote_currency.value}

    if db.exchange_rates.find_one({**pair, "observed_at": body.observed_at}):
        raise HTTPException(status_code=409, detail="Rate already exists for this pair and time")

    status = "VALID"
    prev = db.exchange_rates.find_one(
        {**pair, "observed_at": {"$lt": body.observed_at}}, sort=[("observed_at", -1)]
    )
    if prev:
        old = from_d128(prev["rate"])
        if old > 0 and abs(body.rate - old) / old > UNUSUAL_CHANGE:
            status = "UNUSUAL_CHANGE"

    doc = {
        **pair,
        "rate": to_d128(body.rate),
        "observed_at": body.observed_at,
        "source": body.source.strip(),
        "data_quality_status": status,
        "created_by": str(user["_id"]),
        "created_at": utc_now(),
    }
    doc["_id"] = db.exchange_rates.insert_one(doc).inserted_id
    return _to_response(doc)


@router.get("", response_model=Page[ExchangeRateResponse])
def list_rates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    base_currency: Currency | None = None,
    quote_currency: Currency | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if base_currency:
        query["base_currency"] = base_currency.value
    if quote_currency:
        query["quote_currency"] = quote_currency.value
    total = db.exchange_rates.count_documents(query)
    cursor = (
        db.exchange_rates.find(query).sort("observed_at", -1)
        .skip((page - 1) * page_size).limit(page_size)
    )
    return Page[ExchangeRateResponse](
        items=[_to_response(d) for d in cursor], total=total, page=page, page_size=page_size
    )