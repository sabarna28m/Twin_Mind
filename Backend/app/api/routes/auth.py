import logging
import shutil
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File
from sqlalchemy import or_
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from sqlalchemy.orm import Session

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads" / "avatars"
ALLOWED_MIME = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password, create_access_token, decode_token,
    create_2fa_challenge, decode_2fa_challenge,
    encrypt_totp_secret, decrypt_totp_secret,
    generate_totp_secret, get_totp_uri, verify_totp_code, get_qr_code_base64,
    generate_backup_codes, verify_backup_code,
)
from app.models.user import User
from app.models.password_reset import PasswordResetToken
from app.models.session import Session as StudySession
from app.models.note import Note
from app.models.note_history import NoteHistory
from app.models.note_version import NoteVersion
from app.models.smart_note import SmartNote
from app.models.material import Material
from app.models.student_profile import StudentProfile
from app.models.learning_data import LearningData
from app.models.achievement import UserAchievement
from app.models.burnout import BurnoutEntry
from app.models.career_twin import CareerTwin
from app.models.comm_twin import CommTwin
from app.models.chat_session import ChatSession
from app.models.mentor_conversation import MentorConversation
from app.models.notification import Notification
from app.models.google_token import GoogleToken
from app.models.quiz import QuizSession
from app.models.skill_tree import NodeProgress, XPTransaction, SkillTreeAchievement
from app.models.smart_plan_record import SmartPlanRecord
from app.models.streak_shield import StreakShield
from app.models.study_plan import StudyPlan
from app.models.subject_performance import SubjectRecord
from app.models.weekly_challenge import WeeklyChallenge
from app.models.battle import Battle
from app.api.schemas.auth import (
    RegisterRequest, LoginRequest, LoginResponse, TokenResponse, UserResponse,
    UpdateProfileRequest, ForgotPasswordRequest, ResetPasswordRequest,
    GoogleLoginRequest,
    TwoFASetupResponse, TwoFAEnableRequest, TwoFAEnableResponse,
    TwoFAVerifyLoginRequest, TwoFADisableRequest, TwoFAStatusResponse,
    DeleteAccountRequest,
)

logger = logging.getLogger(__name__)
_MATERIALS_DIR = Path(__file__).resolve().parents[3] / "uploads"

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
                    email = supabase_payload.get("email", "")
                    meta  = supabase_payload.get("user_metadata") or {}
                    name  = meta.get("full_name") or meta.get("name") or (email.split("@")[0] if email else "User")
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


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account was created with Google. Please sign in with Google.",
        )
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # ── 2FA gating ────────────────────────────────────────────────────────────
    if user.twofa_enabled:
        challenge = create_2fa_challenge(user.id)
        return LoginResponse(requires_2fa=True, challenge_token=challenge)

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return LoginResponse(access_token=token)


@router.post("/google-login", response_model=TokenResponse)
def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google authentication is not configured on this server.",
        )
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        idinfo = google_id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid Google token: {exc}")

    google_sub   = idinfo["sub"]
    google_email = idinfo.get("email", "")
    google_name  = idinfo.get("name", google_email.split("@")[0])

    if not google_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account has no email address.")

    user = db.query(User).filter(User.email == google_email).first()
    if user:
        if not user.oauth_provider:
            user.oauth_provider = "google"
            user.oauth_id       = google_sub
            db.commit()
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated.")
    else:
        user = User(
            email=google_email, full_name=google_name,
            hashed_password=None, oauth_provider="google",
            oauth_id=google_sub, is_active=True,
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
    if not user:
        return {"message": "If that email is registered, a reset link has been sent."}

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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 5 MB)")

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / filename).write_bytes(content)

    if current_user.avatar_url:
        old_name = current_user.avatar_url.rsplit("/", 1)[-1]
        old_file = UPLOAD_DIR / old_name
        if old_file.exists():
            old_file.unlink()

    current_user.avatar_url = f"/uploads/avatars/{filename}"
    db.commit()
    db.refresh(current_user)
    return current_user


# ══════════════════════════════════════════════════════════════════════════════
# ACCOUNT DELETION
# ══════════════════════════════════════════════════════════════════════════════

@router.delete("/me", status_code=status.HTTP_200_OK)
def delete_account(
    payload: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete the authenticated user's account and all associated data."""
    # OAuth-only accounts have no password — reject with a clear message
    if not current_user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account was created via Google OAuth and has no password set. "
                   "Contact support to delete your account.",
        )
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect password.")

    user_id   = current_user.id
    user_email = current_user.email
    avatar_url = current_user.avatar_url

    # ── Delete child rows in FK-safe order ───────────────────────────────────
    # 1. note_versions before smart_notes (has FK to smart_notes.id)
    db.query(NoteVersion).filter(NoteVersion.user_id == user_id).delete(synchronize_session=False)
    # 2. note_history (soft-deleted notes archive)
    db.query(NoteHistory).filter(NoteHistory.user_id == user_id).delete(synchronize_session=False)
    # 3. smart_notes
    db.query(SmartNote).filter(SmartNote.user_id == user_id).delete(synchronize_session=False)
    # 4. quiz sessions
    db.query(QuizSession).filter(QuizSession.user_id == user_id).delete(synchronize_session=False)
    # 5. AI chat sessions
    db.query(ChatSession).filter(ChatSession.user_id == user_id).delete(synchronize_session=False)
    # 6. mentor conversations
    db.query(MentorConversation).filter(MentorConversation.user_id == user_id).delete(synchronize_session=False)
    # 7. notifications
    db.query(Notification).filter(Notification.user_id == user_id).delete(synchronize_session=False)
    # 8. password reset tokens
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user_id).delete(synchronize_session=False)
    # 9. Google OAuth tokens
    db.query(GoogleToken).filter(GoogleToken.user_id == user_id).delete(synchronize_session=False)
    # 10. burnout entries
    db.query(BurnoutEntry).filter(BurnoutEntry.user_id == user_id).delete(synchronize_session=False)
    # 11. career twin state
    db.query(CareerTwin).filter(CareerTwin.user_id == user_id).delete(synchronize_session=False)
    # 12. comm twin state
    db.query(CommTwin).filter(CommTwin.user_id == user_id).delete(synchronize_session=False)
    # 13. skill tree progress + XP transactions + skill tree achievements
    db.query(NodeProgress).filter(NodeProgress.user_id == user_id).delete(synchronize_session=False)
    db.query(XPTransaction).filter(XPTransaction.user_id == user_id).delete(synchronize_session=False)
    db.query(SkillTreeAchievement).filter(SkillTreeAchievement.user_id == user_id).delete(synchronize_session=False)
    # 14. gamification achievements
    db.query(UserAchievement).filter(UserAchievement.user_id == user_id).delete(synchronize_session=False)
    # 15. battles (user may be challenger, opponent, or winner)
    db.query(Battle).filter(
        or_(Battle.challenger_id == user_id, Battle.opponent_id == user_id)
    ).delete(synchronize_session=False)
    # 16. weekly challenges
    db.query(WeeklyChallenge).filter(WeeklyChallenge.user_id == user_id).delete(synchronize_session=False)
    # 17. streak shield
    db.query(StreakShield).filter(StreakShield.user_id == user_id).delete(synchronize_session=False)
    # 18. smart plan records
    db.query(SmartPlanRecord).filter(SmartPlanRecord.user_id == user_id).delete(synchronize_session=False)
    # 19. study plans
    db.query(StudyPlan).filter(StudyPlan.user_id == user_id).delete(synchronize_session=False)
    # 20. learning data check-ins
    db.query(LearningData).filter(LearningData.user_id == user_id).delete(synchronize_session=False)
    # 21. subject performance records
    db.query(SubjectRecord).filter(SubjectRecord.user_id == user_id).delete(synchronize_session=False)
    # 22. study sessions
    db.query(StudySession).filter(StudySession.user_id == user_id).delete(synchronize_session=False)
    # 23. uploaded materials (DB rows — files cleaned up below)
    db.query(Material).filter(Material.user_id == user_id).delete(synchronize_session=False)
    # 24. notes
    db.query(Note).filter(Note.user_id == user_id).delete(synchronize_session=False)
    # 25. student profile
    db.query(StudentProfile).filter(StudentProfile.user_id == user_id).delete(synchronize_session=False)
    # 26. the user row itself
    db.delete(current_user)
    db.commit()

    # ── Delete files from disk ────────────────────────────────────────────────
    # Uploaded materials live at uploads/{user_id}/
    user_uploads = _MATERIALS_DIR / str(user_id)
    if user_uploads.exists():
        try:
            shutil.rmtree(user_uploads)
        except OSError as exc:
            logger.warning("Could not remove uploads for user %s: %s", user_id, exc)

    # Avatar lives at uploads/avatars/{filename}
    if avatar_url:
        avatar_name = avatar_url.rsplit("/", 1)[-1]
        avatar_file = UPLOAD_DIR / avatar_name
        if avatar_file.exists():
            try:
                avatar_file.unlink()
            except OSError as exc:
                logger.warning("Could not remove avatar for user %s: %s", user_id, exc)

    logger.info("ACCOUNT_DELETED user_id=%s email=%s", user_id, user_email)
    return {"deleted": True, "message": "Account permanently deleted."}


# ══════════════════════════════════════════════════════════════════════════════
# TWO-FACTOR AUTHENTICATION ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/2fa/status", response_model=TwoFAStatusResponse)
def get_2fa_status(current_user: User = Depends(get_current_user)):
    """Return the current 2FA state for the authenticated user."""
    codes = current_user.twofa_backup_codes or []
    return TwoFAStatusResponse(
        enabled=current_user.twofa_enabled,
        setup_at=current_user.twofa_setup_at,
        backup_codes_remaining=len(codes),
    )


@router.post("/2fa/setup", response_model=TwoFASetupResponse)
def setup_2fa(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a new TOTP secret and QR code for the user.

    Calling this multiple times regenerates the secret (idempotent until /enable
    is called). It does NOT enable 2FA — the user must verify a code first.
    """
    secret = generate_totp_secret()
    uri    = get_totp_uri(secret, current_user.email)
    qr_b64 = get_qr_code_base64(uri)

    # Store encrypted secret but leave twofa_enabled=False until verified
    current_user.twofa_secret = encrypt_totp_secret(secret)
    db.commit()

    # Format manual key with spaces every 4 characters for readability
    manual_key = " ".join(secret[i:i+4] for i in range(0, len(secret), 4))

    return TwoFASetupResponse(secret=manual_key, qr_code=qr_b64, uri=uri)


@router.post("/2fa/enable", response_model=TwoFAEnableResponse)
def enable_2fa(
    payload: TwoFAEnableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify the TOTP code then activate 2FA and issue backup codes."""
    if current_user.twofa_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="2FA is already enabled")
    if not current_user.twofa_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Call /2fa/setup first to generate a secret")

    raw_secret = decrypt_totp_secret(current_user.twofa_secret)
    if not verify_totp_code(raw_secret, payload.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Invalid verification code. Check your authenticator app and try again.")

    plaintext_codes, hashed_codes = generate_backup_codes()

    current_user.twofa_enabled      = True
    current_user.twofa_backup_codes = hashed_codes
    current_user.twofa_setup_at     = datetime.now(timezone.utc)
    db.commit()

    return TwoFAEnableResponse(enabled=True, backup_codes=plaintext_codes)


@router.post("/2fa/disable")
def disable_2fa(
    payload: TwoFADisableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disable 2FA after confirming the account password."""
    if not current_user.twofa_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="2FA is not enabled")
    if not current_user.hashed_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Cannot verify password for OAuth-only accounts")
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect password")

    current_user.twofa_enabled      = False
    current_user.twofa_secret       = None
    current_user.twofa_backup_codes = None
    current_user.twofa_setup_at     = None
    db.commit()

    return {"disabled": True, "message": "Two-factor authentication has been disabled"}


@router.post("/2fa/verify-login", response_model=TokenResponse)
def verify_2fa_login(
    payload: TwoFAVerifyLoginRequest,
    db: Session = Depends(get_db),
):
    """Exchange a valid 2FA challenge token + TOTP/backup code for a full session JWT."""
    user_id = decode_2fa_challenge(payload.challenge_token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid or expired verification session. Please log in again.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.twofa_enabled or not user.twofa_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="2FA is not configured for this account")

    raw_secret = decrypt_totp_secret(user.twofa_secret)
    code = payload.code.strip()

    # Try TOTP code first
    if verify_totp_code(raw_secret, code):
        access_token = create_access_token({"sub": str(user.id), "email": user.email})
        return {"access_token": access_token, "token_type": "bearer"}

    # Try backup code (handles both XXXX-XXXX and XXXXXXXX formats)
    codes = user.twofa_backup_codes or []
    valid, remaining = verify_backup_code(code, codes)
    if valid:
        user.twofa_backup_codes = remaining
        db.commit()
        access_token = create_access_token({"sub": str(user.id), "email": user.email})
        return {"access_token": access_token, "token_type": "bearer"}

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication code. Check your app or use a backup code.",
    )
