from fastapi import APIRouter, HTTPException
from app.database.connection import is_healthy

router = APIRouter(prefix="/api/v1/health", tags=["health"])

@router.get("")
def health():
    return {"status": "ok"}

@router.get("/database")
def health_db():
    if not is_healthy():
        raise HTTPException(status_code=503, detail="Database unreachable")
    return {"status": "ok", "database": "connected"}