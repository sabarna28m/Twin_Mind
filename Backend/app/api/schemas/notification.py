from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: int
    notification_type: str
    message: str
    is_read: bool
    created_at: datetime
    reference_key: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    emoji: Optional[str] = None
    title: Optional[str] = None
    action_url: Optional[str] = None

    class Config:
        from_attributes = True
