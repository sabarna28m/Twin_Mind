from sqlalchemy import Column, Integer, Float, String, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base


class BurnoutEntry(Base):
    __tablename__ = "burnout_entries"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_burnout_user_date"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    study_hours = Column(Float, nullable=False)
    sleep_hours = Column(Float, nullable=False)
    breaks_taken = Column(Integer, nullable=False)
    study_streak_days = Column(Integer, nullable=False, default=0)
    mood_rating = Column(Integer, nullable=False)       # 1–5
    energy_level = Column(Integer, nullable=False)      # 1–5
    burnout_score = Column(Integer, nullable=False)     # 0–100
    risk_level = Column(String(10), nullable=False)     # low / medium / high
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
