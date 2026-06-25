import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

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
    GoogleLoginRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])
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
    token = credentials.credentials

    # ── Supabase JWT (if configured) ─────────────────────────────────────────
    if settings.supabase_jwt_secret:
        try:
            from jose import jwt as _jwt, JWTError as _JWTError
            supabase_payload = _jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            supabase_uid = supabase_payload.get("sub")
            if supabase_uid:
                user = db.query(User).filter(User.supabase_uid == supabase_uid).first()
                if not user:
                    # Auto-provision a local user record for this Supabase identity
                    email = supabase_payload.get("email", "")
                    meta  = supabase_payload.get("user_metadata") or {}
                    name  = meta.get("full_name") or meta.get("name") or (email.split("@")[0] if email else "User")
                    # Avoid duplicate email (existing account pre-dates Supabase migration)
                    user = db.query(User).filter(User.email == email).first()
                    if user:
                        user.supabase_uid = supabase_uid
                    else:
                        user = User(
                            email=email,
                            full_name=name,
                            hashed_password=None,
                            oauth_provider="supabase",
                            supabase_uid=supabase_uid,
                            is_active=True,
                        )
                        db.add(user)
                    db.commit()
                    db.refresh(user)
                if user.is_active:
                    return user
        except Exception:
            pass  # not a Supabase JWT — fall through to custom JWT

    # ── Custom JWT (original flow) ────────────────────────────────────────────
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
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
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    # OAuth-only accounts have no password — guide the user to sign in with Google
    if not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account was created with Google. Please sign in with Google.",
        )
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/google-login", response_model=TokenResponse)
def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    """
    Verify a Google ID token issued by the Google Identity Services button,
    then find-or-create a TwinMind user and return a JWT session token.
    """
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google authentication is not configured on this server.",
        )

    # Verify the Google ID token using Google's public keys
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        idinfo = google_id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {exc}",
        )

    google_sub   = idinfo["sub"]          # unique Google user ID
    google_email = idinfo.get("email", "")
    google_name  = idinfo.get("name", google_email.split("@")[0])

    if not google_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account has no email address.")

    # Find existing user by email (handles linking email/password + Google accounts)
    user = db.query(User).filter(User.email == google_email).first()

    if user:
        # Existing user — update OAuth info if it was an email-only account
        if not user.oauth_provider:
            user.oauth_provider = "google"
            user.oauth_id       = google_sub
            db.commit()
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated.")
    else:
        # New user — create account automatically (no email verification needed;
        # Google already verified the email)
        user = User(
            email           = google_email,
            full_name       = google_name,
            hashed_password = None,   # OAuth-only — no local password
            oauth_provider  = "google",
            oauth_id        = google_sub,
            is_active       = True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

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
