from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class NoteVersion(Base):
    __tablename__ = "note_versions"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("smart_notes.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    title = Column(String(500), nullable=False, default="")
    content = Column(Text, default="")
    subject = Column(String(200), default="")
    saved_at = Column(DateTime(timezone=True), server_default=func.now())
