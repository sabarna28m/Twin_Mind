from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    """Unified login response — normal JWT or 2FA challenge."""
    access_token: Optional[str] = None
    token_type: str = "bearer"
    requires_2fa: bool = False
    challenge_token: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    is_active: bool
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None
    twofa_enabled: bool = False

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class GoogleLoginRequest(BaseModel):
    credential: str


# ── 2FA schemas ───────────────────────────────────────────────────────────────
class TwoFASetupResponse(BaseModel):
    secret: str     # manual entry key (space-separated groups of 4)
    qr_code: str    # base64-encoded PNG
    uri: str        # otpauth:// URI (for apps that accept URIs)


class TwoFAEnableRequest(BaseModel):
    code: str       # 6-digit TOTP code from the authenticator app


class TwoFAEnableResponse(BaseModel):
    enabled: bool
    backup_codes: List[str]   # plaintext, shown exactly once


class TwoFAVerifyLoginRequest(BaseModel):
    challenge_token: str
    code: str       # 6-digit TOTP code OR backup code (XXXX-XXXX)


class TwoFADisableRequest(BaseModel):
    password: str


class TwoFAStatusResponse(BaseModel):
    enabled: bool
    setup_at: Optional[datetime] = None
    backup_codes_remaining: int = 0


class DeleteAccountRequest(BaseModel):
    password: str
