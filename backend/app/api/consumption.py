from datetime import timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import DuplicateKeyError

from app.api.auth import get_current_user
from app.core.decimal_utils import from_d128, to_d128
from app.core.utils import utc_now
from app.database.connection import get_db
from app.schemas.inventory import ConsumptionCreate, ConsumptionResponse, ConsumptionSummary

router = APIRouter(prefix="/api/v1/consumption", tags=["consumption"])


@router.post("", response_model=ConsumptionResponse, status_code=201)
def create_consumption(body: ConsumptionCreate, user: dict = Depends(get_current_user)):
    doc = {
        "date": body.date,
        "consumption_mt": to_d128(body.consumption_mt),
        "source": body.source,
        "created_by": str(user["_id"]),
        "created_at": utc_now(),
    }
    try:
        doc["_id"] = get_db().consumption.insert_one(doc).inserted_id
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Consumption already recorded for this date")
    return ConsumptionResponse(
        id=str(doc["_id"]), date=doc["date"],
        consumption_mt=body.consumption_mt, source=body.source,
    )


@router.get("/summary", response_model=ConsumptionSummary)
def consumption_summary(
    days: int = Query(30, ge=7, le=365),
    user: dict = Depends(get_current_user),
):
    # period = the last N complete days, ending yesterday (UTC)
    end = utc_now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
    start = end - timedelta(days=days - 1)
    docs = list(get_db().consumption.find({"date": {"$gte": start, "$lte": end}}))

    recorded = len(docs)
    total = sum((from_d128(d["consumption_mt"]) for d in docs), Decimal("0"))
    average = (total / recorded).quantize(Decimal("0.001")) if recorded else None

    if recorded == 0:
        status = "NO_DATA"
    elif recorded < days:
        status = "INCOMPLETE"   # missing days are NOT treated as zero consumption
    else:
        status = "VALID"

    return ConsumptionSummary(
        period_start=start, period_end=end, days_requested=days,
        recorded_days=recorded, missing_days=days - recorded,
        total_consumption_mt=total, average_daily_consumption_mt=average,
        data_quality_status=status,
    )