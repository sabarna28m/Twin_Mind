from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.sql import func
from app.core.database import Base
import enum

class EventType(str, enum.Enum):
    STUDY = "Study"
    ASSIGNMENT = "Assignment"
    REVISION = "Revision"
    INTERVIEW_PREP = "Interview Prep"
    PROJECT_WORK = "Project Work"

class Priority(str, enum.Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"

class EventStatus(str, enum.Enum):
    PENDING = "Pending"
    COMPLETED = "Completed"

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    
    event_type = Column(String, nullable=False, default=EventType.STUDY.value)
    priority = Column(String, nullable=False, default=Priority.MEDIUM.value)
    status = Column(String, nullable=False, default=EventStatus.PENDING.value)
    
    reminder_minutes_before = Column(Integer, nullable=False, default=-1)
    notification_sent = Column(Boolean, nullable=False, default=False)
    last_notified_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
