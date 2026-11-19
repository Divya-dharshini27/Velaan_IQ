from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import get_current_user
from app.core.decimal_utils import from_d128, to_d128
from app.core.utils import utc_now
from app.database.connection import get_db
from app.schemas.common import Page
from app.schemas.market import MarketType as SourcingType
from app.schemas.suppliers import SupplierCreate, SupplierResponse

router = APIRouter(prefix="/api/v1/suppliers", tags=["suppliers"])


def _to_response(doc: dict) -> SupplierResponse:
    return SupplierResponse(
        id=str(doc["_id"]),
        supplier_name=doc["supplier_name"],
        sourcing_type=doc["sourcing_type"],
        lead_time_days=doc["lead_time_days"],
        capacity_mt=from_d128(doc["capacity_mt"]),
        minimum_order_mt=from_d128(doc["minimum_order_mt"]),
        quality_specification=doc.get("quality_specification", {}),
        active=doc["active"],
        source=doc.get("source"),
    )


@router.post("", response_model=SupplierResponse, status_code=201)
def create_supplier(body: SupplierCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    if db.suppliers.find_one(
        {"supplier_name": body.supplier_name, "sourcing_type": body.sourcing_type.value}
    ):
        raise HTTPException(status_code=409, detail="Supplier already exists")
    doc = {
        "supplier_name": body.supplier_name,
        "sourcing_type": body.sourcing_type.value,
        "lead_time_days": body.lead_time_days,
        "capacity_mt": to_d128(body.capacity_mt),
        "minimum_order_mt": to_d128(body.minimum_order_mt),
        "quality_specification": body.quality_specification,
        "active": body.active,
        "source": "MANUAL_ENTRY",
        "created_by": str(user["_id"]),
        "created_at": utc_now(),
    }
    doc["_id"] = db.suppliers.insert_one(doc).inserted_id
    return _to_response(doc)


@router.get("", response_model=Page[SupplierResponse])
def list_suppliers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sourcing_type: SourcingType | None = None,
    active: bool | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if sourcing_type:
        query["sourcing_type"] = sourcing_type.value
    if active is not None:
        query["active"] = active
    total = db.suppliers.count_documents(query)
    cursor = (
        db.suppliers.find(query).sort("supplier_name", 1)
        .skip((page - 1) * page_size).limit(page_size)
    )
    return Page[SupplierResponse](
        items=[_to_response(d) for d in cursor], total=total, page=page, page_size=page_size
    )