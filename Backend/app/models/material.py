from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    original_name = Column(String, nullable=False)
    stored_name = Column(String, nullable=False)   # UUID-based filename on disk
    mime_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)    # bytes
    created_at = Column(DateTime(timezone=True), server_default=func.now())
