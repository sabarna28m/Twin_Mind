from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class QuizSession(Base):
    __tablename__ = "quiz_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject = Column(String(200), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    difficulty = Column(String(20), nullable=False)
    questions = Column(Text, nullable=False)   # JSON array of {question, options, correct}
    answers = Column(Text, nullable=True)      # JSON array of int|null (user's chosen index)
    score = Column(Integer, nullable=True)
    total = Column(Integer, nullable=True)
    time_taken = Column(Integer, nullable=True)  # seconds
    created_at = Column(DateTime(timezone=True), server_default=func.now())
