from sqlalchemy import Column, Integer, Float, String, Text, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base


class LearningData(Base):
    __tablename__ = "learning_data"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_user_date"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    study_hours = Column(Float, nullable=False)
    attendance_percentage = Column(Float, nullable=False)          # 0–100
    assignment_completion_rate = Column(Float, nullable=False)     # 0–100
    quiz_scores = Column(Float, nullable=True)                     # 0–100
    exam_scores = Column(Float, nullable=True)                     # 0–100
    sleep_duration = Column(Float, nullable=False)                 # hours
    stress_level = Column(Integer, nullable=False)                 # 1–10
    notes = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
