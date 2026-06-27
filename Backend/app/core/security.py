import base64
import hashlib
import io
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional

import pyotp
import qrcode
from cryptography.fernet import Fernet
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password helpers ──────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT helpers ───────────────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None


# ── 2FA challenge token (5-minute, stateless) ─────────────────────────────────
def create_2fa_challenge(user_id: int) -> str:
    """Short-lived JWT used as a ticket between password-OK and TOTP-OK steps."""
    payload = {
        "sub": str(user_id),
        "purpose": "2fa_challenge",
        "exp": datetime.utcnow() + timedelta(minutes=5),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_2fa_challenge(token: str) -> Optional[int]:
    """Returns user_id if the challenge token is valid, else None."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("purpose") != "2fa_challenge":
            return None
        return int(payload["sub"])
    except (JWTError, ValueError, TypeError):
        return None


# ── TOTP secret encryption (Fernet, key derived from SECRET_KEY) ──────────────
def _get_fernet() -> Fernet:
    key_bytes = hashlib.sha256(settings.secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key_bytes))


def encrypt_totp_secret(secret: str) -> str:
    return _get_fernet().encrypt(secret.encode()).decode()


def decrypt_totp_secret(encrypted: str) -> str:
    return _get_fernet().decrypt(encrypted.encode()).decode()


# ── TOTP helpers ──────────────────────────────────────────────────────────────
def generate_totp_secret() -> str:
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="TwinMind")


def verify_totp_code(secret: str, code: str) -> bool:
    """Verify a 6-digit TOTP code with ±1 time-step (30 s) tolerance."""
    return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)


def get_qr_code_base64(uri: str) -> str:
    """Render the otpauth URI as a QR code PNG and return base64."""
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


# ── Backup codes ──────────────────────────────────────────────────────────────
# Unambiguous character set: no I, O, 0, 1
_BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_backup_codes() -> tuple[list[str], list[str]]:
    """Generate 8 single-use backup codes.

    Returns:
        plaintext: list of 'XXXX-XXXX' codes shown to the user once
        hashed:    list of bcrypt hashes stored in the database
    """
    plaintext, hashed = [], []
    for _ in range(8):
        raw = "".join(secrets.choice(_BACKUP_ALPHABET) for _ in range(8))
        formatted = f"{raw[:4]}-{raw[4:]}"
        plaintext.append(formatted)
        hashed.append(hash_password(raw))  # hash without dash for canonical comparison
    return plaintext, hashed


def verify_backup_code(code: str, hashes: list[str]) -> tuple[bool, list[str]]:
    """Check a submitted backup code against the stored hash list.

    Returns:
        (True, remaining_hashes) on match — the matched code is consumed
        (False, original_hashes) on no match
    """
    clean = code.replace("-", "").upper()
    for i, h in enumerate(hashes):
        if verify_password(clean, h):
            return True, hashes[:i] + hashes[i + 1:]
    return False, hashes
