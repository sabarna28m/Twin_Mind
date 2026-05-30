from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class SessionCreate(BaseModel):
    title: str
    subject: Optional[str] = None
    duration_minutes: Optional[int] = 0


class SessionUpdate(BaseModel):
    title: Optional[str] = None
    subject: Optional[str] = None
    duration_minutes: Optional[int] = None
    status: Optional[str] = None


class SessionResponse(BaseModel):
    id: int
    user_id: int
    title: str
    subject: Optional[str] = None
    duration_minutes: int
    status: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
