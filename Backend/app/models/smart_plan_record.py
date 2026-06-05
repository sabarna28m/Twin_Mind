from sqlalchemy import Column, Integer, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class SmartPlanRecord(Base):
    __tablename__ = "smart_plan_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    plan_content = Column(Text, nullable=False)  # JSON-serialised SmartPlanResponse
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, nullable=False, default=True)
