from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from app.core.database import Base


class Battle(Base):
    __tablename__ = "battles"

    id = Column(Integer, primary_key=True, index=True)
    challenger_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    opponent_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    battle_type = Column(String(20), nullable=False)   # quiz / study_hours / streak
    target_value = Column(Float, nullable=False)
    duration = Column(String(10), nullable=False)       # 24hr / 48hr / 1week
    status = Column(String(20), nullable=False, default="pending")  # pending / active / completed / cancelled
    winner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    invite_code = Column(String(20), unique=True, nullable=False, index=True)
    is_random = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
