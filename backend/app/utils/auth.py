from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from supabase import create_client, Client

from app.config import settings
from app.utils.errors import UnauthorizedError
from app.utils.mock_db import MockSupabaseClient
import logging

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

_supabase_client = None


def get_supabase():
    global _supabase_client
    if _supabase_client is None:
        if (
            not settings.SUPABASE_URL
            or not settings.SUPABASE_KEY
            or "your-project-id" in settings.SUPABASE_URL
        ):
            logger.info("Using local in-memory database store (configure SUPABASE_URL to connect to Supabase).")
            _supabase_client = MockSupabaseClient()
        else:
            _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return _supabase_client


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        raise UnauthorizedError("Invalid or expired authentication token")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    if not credentials or not credentials.credentials:
        raise UnauthorizedError("Authentication token is missing")

    token = credentials.credentials
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Token payload missing user identifier")

    try:
        supabase = get_supabase()
        response = supabase.table("users").select("id, name, email, created_at").eq("id", user_id).limit(1).execute()
        if not response.data:
            raise UnauthorizedError("User associated with this token does not exist")
        return response.data[0]
    except UnauthorizedError:
        raise
    except Exception as exc:
        raise UnauthorizedError(f"Authentication failed: {str(exc)}")
