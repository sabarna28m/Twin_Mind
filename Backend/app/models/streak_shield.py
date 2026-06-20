from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, ForeignKey, Text
from app.core.database import Base


class StreakShield(Base):
    __tablename__ = "streak_shields"
    id                       = Column(Integer, primary_key=True, index=True)
    user_id                  = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    # Standard shield (covers 1 missed day, auto-applies)
    shield_count             = Column(Integer, default=0)
    auto_use_shield          = Column(Boolean, default=True)
    # Premium shield (covers up to 3 consecutive missed days)
    premium_shield_count     = Column(Integer, default=0)
    # Streak freeze (manual freeze for 1 day — stored as expiry date)
    streak_freeze_expires    = Column(DateTime, nullable=True)
    # Double XP boost (all earned XP ×2 until expiry)
    double_xp_expires        = Column(DateTime, nullable=True)
    # Recovery (emergency, once per month)
    recovery_used_month      = Column(Integer, nullable=True)
    recovery_used_year       = Column(Integer, nullable=True)
    streak_recovery_deadline = Column(DateTime, nullable=True)
    # Shared protected dates store (JSON ISO date list)
    shield_protected_dates   = Column(Text, default="[]")
    xp_spent                 = Column(Integer, default=0)
    updated_at               = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
