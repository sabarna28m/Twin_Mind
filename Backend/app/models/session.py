from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    subject = Column(String, nullable=True)
    duration_minutes = Column(Integer, default=0)
    status = Column(String, default="active")  # active | completed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
