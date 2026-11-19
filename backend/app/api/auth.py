from datetime import datetime, timezone

import jwt
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.errors import DuplicateKeyError

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.database.connection import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
bearer_scheme = HTTPBearer()


def _user_to_response(user: dict) -> UserResponse:
    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        full_name=user["full_name"],
        role=user["role"],
        created_at=user["created_at"],
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = ObjectId(payload["sub"])
    except (jwt.PyJWTError, KeyError, InvalidId):
        raise unauthorized

    user = get_db().users.find_one({"_id": user_id})
    if not user or not user.get("is_active", True):
        raise unauthorized
    return user


@router.post("/register", response_model=UserResponse, status_code=201)
def register(body: RegisterRequest):
    now = datetime.now(timezone.utc)
    doc = {
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "full_name": body.full_name.strip(),
        "role": "PROCUREMENT_MANAGER",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = get_db().users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Email already registered")
    doc["_id"] = result.inserted_id
    return _user_to_response(doc)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    user = get_db().users.find_one({"email": body.email.lower()})
    # same message for unknown email and wrong password, so emails can't be probed
    if (
        not user
        or not user.get("is_active", True)
        or not verify_password(body.password, user["password_hash"])
    ):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return TokenResponse(access_token=create_access_token(str(user["_id"])))


@router.get("/me", response_model=UserResponse)
def me(current_user: dict = Depends(get_current_user)):
    return _user_to_response(current_user)