from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, ForeignKey, Text
from app.core.database import Base


class StreakShield(Base):
    __tablename__ = "streak_shields"
    id                       = Column(Integer, primary_key=True, index=True)
    user_id                  = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    shield_count             = Column(Integer, default=0)
    auto_use_shield          = Column(Boolean, default=True)
    recovery_used_month      = Column(Integer, nullable=True)
    recovery_used_year       = Column(Integer, nullable=True)
    streak_recovery_deadline = Column(DateTime, nullable=True)
    shield_protected_dates   = Column(Text, default="[]")   # JSON list of ISO date strings
    xp_spent                 = Column(Integer, default=0)
    updated_at               = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
