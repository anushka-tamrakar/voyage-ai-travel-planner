from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, status

from app.schemas.auth import RegisterRequest, LoginRequest, AuthResponse, UserResponse
from app.utils.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    get_supabase
)
from app.utils.errors import ValidationError, UnauthorizedError

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest):
    supabase = get_supabase()
    try:
        # Check if user already exists
        existing = supabase.table("users").select("id").eq("email", payload.email.lower()).execute()
    except Exception as exc:
        logger.error("Supabase error during user check: %s", exc)
        raise ValidationError(f"Database error checking user: {str(exc)}. Please verify that Supabase tables are created using supabase_schema.sql.")

    if existing.data:
        raise ValidationError("An account with this email already exists.")

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    hashed = get_password_hash(payload.password)

    user_record = {
        "id": user_id,
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "password_hash": hashed,
        "created_at": now
    }

    try:
        res = supabase.table("users").insert(user_record).execute()
    except Exception as exc:
        logger.error("Supabase error during user insertion: %s", exc)
        raise ValidationError(f"Database error registering user: {str(exc)}. Please check Supabase table schema and RLS policies.")

    if not res.data:
        raise ValidationError("Could not register user. Please try again.")

    user = res.data[0]
    token = create_access_token(data={"sub": user["id"], "email": user["email"]})

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            created_at=user.get("created_at")
        )
    )


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    supabase = get_supabase()
    try:
        res = supabase.table("users").select("*").eq("email", payload.email.lower()).limit(1).execute()
    except Exception as exc:
        logger.error("Supabase error during login query: %s", exc)
        raise ValidationError(f"Database error during login: {str(exc)}. If using Supabase, please verify the 'users' table exists.")

    if not res.data:
        raise UnauthorizedError("Invalid email or password.")

    user = res.data[0]
    if not verify_password(payload.password, user.get("password_hash", "")):
        raise UnauthorizedError("Invalid email or password.")

    token = create_access_token(data={"sub": user["id"], "email": user["email"]})

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            created_at=user.get("created_at")
        )
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        name=current_user["name"],
        email=current_user["email"],
        created_at=current_user.get("created_at")
    )
