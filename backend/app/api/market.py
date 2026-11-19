import io
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import ValidationError
from pymongo.errors import DuplicateKeyError

from app.api.auth import get_current_user
from app.core.decimal_utils import from_d128, to_d128
from app.core.utils import utc_now
from app.database.connection import get_db
from app.schemas.market import (
    MarketPriceCreate,
    MarketPricePage,
    MarketPriceResponse,
    MarketSummary,
    MarketSummaryItem,
    MarketType,
    UploadResult,
    UploadRowError,
)

router = APIRouter(prefix="/api/v1/market-prices", tags=["market"])

# multiply a price per <unit> by this factor to get price per metric tonne
UNIT_TO_MT = {"MT": Decimal("1"), "QUINTAL": Decimal("10"), "KG": Decimal("1000")}
UNUSUAL_CHANGE = Decimal("0.20")   # flag moves above 20% versus the previous record
STALE_AFTER_DAYS = 3

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_UPLOAD_ROWS = 2000
REQUIRED_COLUMNS = ["market_type", "market_name", "price", "currency", "unit", "observed_at", "source"]
OPTIONAL_COLUMNS = ["commodity", "quality_grade"]


def _to_response(doc: dict) -> MarketPriceResponse:
    return MarketPriceResponse(
        id=str(doc["_id"]),
        commodity=doc["commodity"],
        market_type=doc["market_type"],
        market_name=doc["market_name"],
        price=from_d128(doc["price"]),
        currency=doc["currency"],
        unit=doc["unit"],
        price_per_mt=from_d128(doc["price_per_mt"]),
        observed_at=doc["observed_at"],
        source=doc["source"],
        quality_grade=doc.get("quality_grade"),
        data_quality_status=doc.get("data_quality_status", "VALID"),
        created_at=doc["created_at"],
    )


def _build_doc(db, body: MarketPriceCreate, user_id: str) -> dict:
    """Convert to price per MT and run the data-quality check. Shared by single entry and upload."""
    price_per_mt = (body.price * UNIT_TO_MT[body.unit.value]).quantize(Decimal("0.01"))

    status = "VALID"
    prev = db.market_prices.find_one(
        {
            "commodity": body.commodity,
            "market_type": body.market_type.value,
            "market_name": body.market_name,
            "observed_at": {"$lt": body.observed_at},
        },
        sort=[("observed_at", -1)],
    )
    if prev and prev["currency"] == body.currency.value:
        old = from_d128(prev["price_per_mt"])
        if old > 0 and abs(price_per_mt - old) / old > UNUSUAL_CHANGE:
            status = "UNUSUAL_CHANGE"

    return {
        "commodity": body.commodity,
        "market_type": body.market_type.value,
        "market_name": body.market_name,
        "price": to_d128(body.price),
        "currency": body.currency.value,
        "unit": body.unit.value,
        "price_per_mt": to_d128(price_per_mt),
        "observed_at": body.observed_at,
        "source": body.source,
        "quality_grade": body.quality_grade,
        "data_quality_status": status,
        "created_by": user_id,
        "created_at": utc_now(),
    }


@router.post("", response_model=MarketPriceResponse, status_code=201)
def create_price(body: MarketPriceCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = _build_doc(db, body, str(user["_id"]))
    try:
        doc["_id"] = db.market_prices.insert_one(doc).inserted_id
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Price record already exists for this market and date")
    return _to_response(doc)


@router.get("", response_model=MarketPricePage)
def list_prices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    market_type: MarketType | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if market_type:
        query["market_type"] = market_type.value
    total = db.market_prices.count_documents(query)
    cursor = (
        db.market_prices.find(query)
        .sort("observed_at", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    return MarketPricePage(
        items=[_to_response(d) for d in cursor],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/upload", response_model=UploadResult)
def upload_prices(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    filename = (file.filename or "").lower()
    raw = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 5 MB)")

    # read everything as text, so prices never pass through binary floats
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(raw), dtype=str, keep_default_na=False, encoding="utf-8-sig")
        elif filename.endswith(".xlsx"):
            df = pd.read_excel(io.BytesIO(raw), dtype=str, engine="openpyxl")
        else:
            raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read the file. Check that it is a valid CSV or XLSX")

    df = df.fillna("")
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing required columns: {', '.join(missing)}")
    if len(df) == 0:
        raise HTTPException(status_code=422, detail="The file has no data rows")
    if len(df) > MAX_UPLOAD_ROWS:
        raise HTTPException(status_code=422, detail=f"Too many rows (max {MAX_UPLOAD_ROWS})")

    errors: list[UploadRowError] = []
    valid: list[tuple[int, MarketPriceCreate]] = []

    for idx, rec in enumerate(df.to_dict("records")):
        row_no = idx + 2  # row 1 is the header
        payload = {c: str(rec[c]).strip() for c in REQUIRED_COLUMNS + OPTIONAL_COLUMNS if c in rec}
        for c in OPTIONAL_COLUMNS:
            if payload.get(c, None) == "":
                payload.pop(c, None)
        for c in ("market_type", "currency", "unit"):
            payload[c] = payload[c].upper()
        try:
            valid.append((row_no, MarketPriceCreate(**payload)))
        except ValidationError as e:
            msg = "; ".join(f"{'.'.join(str(p) for p in x['loc'])}: {x['msg']}" for x in e.errors())
            errors.append(UploadRowError(row=row_no, error=msg))

    # oldest first, so each row's unusual-change check sees the earlier rows
    valid.sort(key=lambda item: item[1].observed_at)

    db = get_db()
    inserted = duplicates = flagged = 0
    for row_no, body in valid:
        doc = _build_doc(db, body, str(user["_id"]))
        try:
            db.market_prices.insert_one(doc)
        except DuplicateKeyError:
            duplicates += 1
            continue
        inserted += 1
        if doc["data_quality_status"] != "VALID":
            flagged += 1

    errors.sort(key=lambda e: e.row)
    return UploadResult(
        filename=file.filename or "",
        total_rows=len(df),
        inserted=inserted,
        duplicates=duplicates,
        flagged_unusual=flagged,
        rejected=len(errors),
        errors=errors[:50],
    )


def _pct_change(latest: Decimal, old: Decimal | None) -> Decimal | None:
    if old is None or old <= 0:
        return None
    return ((latest - old) / old * 100).quantize(Decimal("0.01"))


@router.get("/summary", response_model=MarketSummary)
def market_summary(user: dict = Depends(get_current_user)):
    db = get_db()
    now = utc_now()
    items: list[MarketSummaryItem] = []

    for market_type in ("DOMESTIC", "INTERNATIONAL"):
        latest = db.market_prices.find_one(
            {"commodity": "SOYBEAN", "market_type": market_type}, sort=[("observed_at", -1)]
        )
        if not latest:
            continue

        # one market and one currency per summary row, so prices are never mixed
        scope = {
            "commodity": "SOYBEAN",
            "market_type": market_type,
            "market_name": latest["market_name"],
            "currency": latest["currency"],
        }
        latest_at = latest["observed_at"]
        latest_price = from_d128(latest["price_per_mt"])

        def price_at_or_before(days: int) -> Decimal | None:
            ref = db.market_prices.find_one(
                {**scope, "observed_at": {"$lte": latest_at - timedelta(days=days)}},
                sort=[("observed_at", -1)],
            )
            return from_d128(ref["price_per_mt"]) if ref else None

        window = list(db.market_prices.find({**scope, "observed_at": {"$gte": latest_at - timedelta(days=30)}}))
        prices = [from_d128(d["price_per_mt"]) for d in window]
        flagged = sum(1 for d in window if d.get("data_quality_status", "VALID") != "VALID")

        if now - latest_at > timedelta(days=STALE_AFTER_DAYS):
            status = "STALE"
        else:
            status = latest.get("data_quality_status", "VALID")

        items.append(MarketSummaryItem(
            market_type=market_type,
            market_name=latest["market_name"],
            currency=latest["currency"],
            latest_price_per_mt=latest_price,
            latest_observed_at=latest_at,
            change_7d_pct=_pct_change(latest_price, price_at_or_before(7)),
            change_30d_pct=_pct_change(latest_price, price_at_or_before(30)),
            min_30d=min(prices),
            max_30d=max(prices),
            avg_30d=(sum(prices, Decimal("0")) / len(prices)).quantize(Decimal("0.01")),
            records_30d=len(prices),
            flagged_records_30d=flagged,
            data_quality_status=status,
        ))

    return MarketSummary(as_of=now, items=items)