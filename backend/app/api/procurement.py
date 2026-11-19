from fastapi import APIRouter, Depends, Query

from app.api.auth import get_current_user
from app.core.decimal_utils import from_d128
from app.database.connection import get_db
from app.schemas.common import Page
from app.schemas.procurement import DecisionSummary, ProcurementRequest, ProcurementResponse
from app.services import procurement_service

router = APIRouter(prefix="/api/v1/procurement", tags=["procurement"])


@router.post("/recommend", response_model=ProcurementResponse)
def recommend(body: ProcurementRequest, user: dict = Depends(get_current_user)):
    return procurement_service.recommend(get_db(), body, str(user["_id"]))


@router.get("/decisions", response_model=Page[DecisionSummary])
def decisions(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
              user: dict = Depends(get_current_user)):
    db = get_db()
    total = db.procurement_decisions.count_documents({})
    cursor = (db.procurement_decisions.find().sort("decision_date", -1)
              .skip((page - 1) * page_size).limit(page_size))
    items = [DecisionSummary(
        id=str(d["_id"]), decision_date=d["decision_date"], action=d["action"],
        sourcing_route=d.get("sourcing_route"),
        recommended_quantity_mt=from_d128(d["recommended_quantity_mt"]),
        inventory_coverage_days=from_d128(d["inventory_coverage_days"]) if d.get("inventory_coverage_days") is not None else None,
        data_quality_status=d["data_quality_status"], reasoning=d["reasoning"]) for d in cursor]
    return Page[DecisionSummary](items=items, total=total, page=page, page_size=page_size)