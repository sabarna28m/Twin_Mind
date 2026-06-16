from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class SmartNote(Base):
    __tablename__ = "smart_notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(500), nullable=False, default="Untitled Note")
    content = Column(Text, default="")
    subject = Column(String(200), default="")
    tags = Column(Text, default="[]")          # JSON array string
    is_pinned = Column(Boolean, default=False)
    version_number = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
