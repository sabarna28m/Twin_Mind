from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    notification_type = Column(String(50), nullable=False)
    message = Column(String(500), nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    reference_key = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # AI-enhanced fields
    priority = Column(String(20), nullable=True)    # critical | important | informational
    category = Column(String(50), nullable=True)    # study_reminder | weak_subject | burnout_alert | …
    emoji = Column(String(10), nullable=True)
    title = Column(String(200), nullable=True)
    action_url = Column(String(300), nullable=True)
