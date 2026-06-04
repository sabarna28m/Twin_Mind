from sqlalchemy import Column, Integer, Float, String, Text, Date, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class SubjectRecord(Base):
    __tablename__ = "subject_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String(100), nullable=False)
    date = Column(Date, nullable=False)
    score = Column(Float, nullable=False)           # 0–100
    study_hours = Column(Float, default=0.0)
    confidence = Column(Integer, default=3)         # 1–5
    source = Column(String(20), default="manual")   # manual/quiz/exam/assignment
    topics_json = Column(Text, default="[]")        # JSON [{"name": "Mechanics", "score": 45}]
    notes = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
