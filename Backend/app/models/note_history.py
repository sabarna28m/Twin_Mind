from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class NoteHistory(Base):
    __tablename__ = "note_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    original_note_id = Column(Integer, nullable=False)
    title = Column(String(500), nullable=False, default="")
    content = Column(Text, default="")
    subject = Column(String(200), default="")
    tags = Column(Text, default="[]")
    version_number = Column(Integer, default=1)
    original_created_at = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), server_default=func.now())
