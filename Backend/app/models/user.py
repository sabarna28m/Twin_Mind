from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String, unique=True, index=True, nullable=False)
    full_name       = Column(String, nullable=False)
    hashed_password = Column(String, nullable=True)   # NULL for OAuth-only accounts
    is_active       = Column(Boolean, default=True)
    avatar_url      = Column(String, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    # Google OAuth fields
    oauth_provider  = Column(String, nullable=True)   # e.g. "google"
    oauth_id        = Column(String, nullable=True)   # Google "sub" claim

    # Supabase Auth — UUID of the corresponding auth.users row
    supabase_uid    = Column(String, nullable=True, unique=True, index=True)

    # Two-Factor Authentication (TOTP)
    twofa_secret       = Column(String, nullable=True)             # Fernet-encrypted TOTP secret
    twofa_enabled      = Column(Boolean, nullable=False, default=False, server_default="false")
    twofa_backup_codes = Column(JSON, nullable=True)               # list[str] bcrypt hashes (single-use)
    twofa_setup_at     = Column(DateTime(timezone=True), nullable=True)
