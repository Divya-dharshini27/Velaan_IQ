from datetime import datetime, timedelta, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(v: datetime) -> datetime:
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    return v.astimezone(timezone.utc)


def past_utc(v: datetime) -> datetime:
    v = ensure_utc(v)
    if v > utc_now() + timedelta(days=1):
        raise ValueError("date cannot be in the future")
    return v


def parse_object_id(value: str, label: str = "id") -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=422, detail=f"Invalid {label}")