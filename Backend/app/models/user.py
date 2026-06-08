from sqlalchemy import Column, Integer, String, Boolean, DateTime
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
