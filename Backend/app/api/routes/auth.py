import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from sqlalchemy.orm import Session

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads" / "avatars"
ALLOWED_MIME = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, decode_token
from app.models.user import User
from app.models.password_reset import PasswordResetToken
from app.api.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse, UserResponse,
    UpdateProfileRequest, ForgotPasswordRequest, ResetPasswordRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"


def _verify_captcha(token: str) -> None:
    try:
        resp = httpx.post(
            _RECAPTCHA_VERIFY_URL,
            data={"secret": settings.recaptcha_secret_key, "response": token},
            timeout=5.0,
        )
        if not resp.json().get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CAPTCHA verification failed. Please complete the CAPTCHA and try again.",
            )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CAPTCHA service unavailable. Please try again.",
        )
bearer = HTTPBearer()

_mail_conf = ConnectionConfig(
    MAIL_USERNAME=settings.mail_username,
    MAIL_PASSWORD=settings.mail_password,
    MAIL_FROM=settings.mail_from,
    MAIL_PORT=settings.mail_port,
    MAIL_SERVER=settings.mail_server,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    _verify_captcha(payload.captcha_token)
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    _verify_captcha(payload.captcha_token)
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_me(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name

    if payload.new_password is not None:
        if not payload.current_password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password required")
        if not verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
        current_user.hashed_password = hash_password(payload.new_password)

    db.commit()
    db.refresh(current_user)
    return current_user


async def _send_reset_email(email: str, reset_link: str) -> None:
    message = MessageSchema(
        subject="TwinMind — Reset your password",
        recipients=[email],
        body=f"""
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0f172a;color:#f1f5f9;border-radius:16px;">
          <h1 style="color:#818cf8;font-size:1.5rem;margin-bottom:8px;">◈ TwinMind</h1>
          <h2 style="font-size:1.1rem;font-weight:600;margin-bottom:16px;">Password Reset Request</h2>
          <p style="color:#94a3b8;margin-bottom:24px;">
            We received a request to reset your TwinMind password. Click the button below to choose a new password.
            This link expires in <strong style="color:#f1f5f9;">1 hour</strong>.
          </p>
          <a href="{reset_link}"
             style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);
                    color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:0.95rem;">
            Reset Password →
          </a>
          <p style="margin-top:24px;color:#475569;font-size:0.8rem;">
            If you didn't request this, you can safely ignore this email. Your password won't change.
          </p>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0;" />
          <p style="color:#334155;font-size:0.75rem;">TwinMind · Your AI-powered academic twin</p>
        </div>
        """,
        subtype=MessageType.html,
    )
    fm = FastMail(_mail_conf)
    await fm.send_message(message)


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == payload.email).first()
    # Always return success to avoid email enumeration
    if not user:
        return {"message": "If that email is registered, a reset link has been sent."}

    # Invalidate any existing unused tokens for this user
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,  # noqa: E712
    ).update({"used": True})
    db.commit()

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    reset_record = PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at)
    db.add(reset_record)
    db.commit()

    reset_link = f"{settings.frontend_url}/reset-password?token={token}"
    background_tasks.add_task(_send_reset_email, user.email, reset_link)

    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == payload.token,
        PasswordResetToken.used == False,  # noqa: E712
    ).first()

    if not record:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    now = datetime.now(timezone.utc)
    expires = record.expires_at
    # Make expires_at timezone-aware if stored as naive UTC
    if expires.tzinfo is None:
        from datetime import timezone as tz
        expires = expires.replace(tzinfo=tz.utc)

    if now > expires:
        record.used = True
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token has expired")

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found")

    user.hashed_password = hash_password(payload.new_password)
    record.used = True
    db.commit()

    return {"message": "Password updated successfully"}


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Only JPEG, PNG, GIF, or WebP images are allowed")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="File too large (max 5 MB)")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / filename).write_bytes(content)

    # Delete old avatar file
    if current_user.avatar_url:
        old_name = current_user.avatar_url.rsplit("/", 1)[-1]
        old_file = UPLOAD_DIR / old_name
        if old_file.exists():
            old_file.unlink()

    current_user.avatar_url = f"/uploads/avatars/{filename}"
    db.commit()
    db.refresh(current_user)
    return current_user
