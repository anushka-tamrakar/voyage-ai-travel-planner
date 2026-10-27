from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full name of user (min 2 chars)")
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., min_length=8, max_length=128, description="Password (min 8 chars)")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    created_at: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
