from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import get_current_user
from app.core.decimal_utils import from_d128, to_d128
from app.core.utils import parse_object_id, utc_now
from app.database.connection import get_db
from app.schemas.common import Page
from app.schemas.purchase_orders import POStatus, PurchaseOrderCreate, PurchaseOrderResponse

router = APIRouter(prefix="/api/v1/purchase-orders", tags=["purchase-orders"])


def _to_response(doc: dict, names: dict) -> PurchaseOrderResponse:
    return PurchaseOrderResponse(
        id=str(doc["_id"]),
        supplier_id=str(doc["supplier_id"]),
        supplier_name=names.get(doc["supplier_id"]),
        quantity_mt=from_d128(doc["quantity_mt"]),
        ordered_at=doc["ordered_at"],
        expected_arrival=doc["expected_arrival"],
        status=doc["status"],
        received_quantity_mt=from_d128(doc["received_quantity_mt"]),
    )


@router.post("", response_model=PurchaseOrderResponse, status_code=201)
def create_purchase_order(body: PurchaseOrderCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    supplier = db.suppliers.find_one({"_id": parse_object_id(body.supplier_id, "supplier_id")})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if not supplier.get("active", True):
        raise HTTPException(status_code=400, detail="Supplier is not active")
    if body.quantity_mt < from_d128(supplier["minimum_order_mt"]):
        raise HTTPException(status_code=400, detail="Quantity is below the supplier's minimum order")

    ordered_at = body.ordered_at or utc_now()
    if body.expected_arrival < ordered_at:
        raise HTTPException(status_code=422, detail="expected_arrival cannot be before ordered_at")

    doc = {
        "supplier_id": supplier["_id"],
        "quantity_mt": to_d128(body.quantity_mt),
        "ordered_at": ordered_at,
        "expected_arrival": body.expected_arrival,
        "status": body.status.value,
        "received_quantity_mt": to_d128(body.received_quantity_mt),
        "created_by": str(user["_id"]),
        "created_at": utc_now(),
    }
    doc["_id"] = db.purchase_orders.insert_one(doc).inserted_id
    return _to_response(doc, {supplier["_id"]: supplier["supplier_name"]})


@router.get("", response_model=Page[PurchaseOrderResponse])
def list_purchase_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: POStatus | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {"status": status.value} if status else {}
    total = db.purchase_orders.count_documents(query)
    docs = list(
        db.purchase_orders.find(query).sort("expected_arrival", 1)
        .skip((page - 1) * page_size).limit(page_size)
    )
    ids = list({d["supplier_id"] for d in docs})
    names = {s["_id"]: s["supplier_name"]
             for s in db.suppliers.find({"_id": {"$in": ids}}, {"supplier_name": 1})}
    return Page[PurchaseOrderResponse](
        items=[_to_response(d, names) for d in docs], total=total, page=page, page_size=page_size
    )