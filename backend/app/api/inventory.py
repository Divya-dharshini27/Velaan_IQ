from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import get_current_user
from app.core.decimal_utils import from_d128, to_d128
from app.core.utils import utc_now
from app.database.connection import get_db
from app.schemas.inventory import InventoryCreate, InventoryResponse

router = APIRouter(prefix="/api/v1/inventory", tags=["inventory"])


def _to_response(doc: dict) -> InventoryResponse:
    available = from_d128(doc["available_stock_mt"])
    reserved = from_d128(doc["reserved_stock_mt"])
    capacity = from_d128(doc["storage_capacity_mt"])
    return InventoryResponse(
        id=str(doc["_id"]),
        commodity=doc["commodity"],
        available_stock_mt=available,
        reserved_stock_mt=reserved,
        net_available_stock_mt=available - reserved,
        storage_capacity_mt=capacity,
        free_storage_mt=capacity - available,
        as_of=doc["as_of"],
        source=doc.get("source"),
    )


@router.post("", response_model=InventoryResponse, status_code=201)
def create_inventory(body: InventoryCreate, user: dict = Depends(get_current_user)):
    # every post is a new dated snapshot, so inventory history is kept
    doc = {
        "commodity": body.commodity.strip().upper(),
        "available_stock_mt": to_d128(body.available_stock_mt),
        "reserved_stock_mt": to_d128(body.reserved_stock_mt),
        "storage_capacity_mt": to_d128(body.storage_capacity_mt),
        "as_of": body.as_of or utc_now(),
        "source": "MANUAL_ENTRY",
        "created_by": str(user["_id"]),
        "created_at": utc_now(),
    }
    doc["_id"] = get_db().inventory.insert_one(doc).inserted_id
    return _to_response(doc)


@router.get("", response_model=InventoryResponse)
def latest_inventory(commodity: str = "SOYBEAN", user: dict = Depends(get_current_user)):
    doc = get_db().inventory.find_one({"commodity": commodity.upper()}, sort=[("as_of", -1)])
    if not doc:
        raise HTTPException(status_code=404, detail="No inventory record found")
    return _to_response(doc)