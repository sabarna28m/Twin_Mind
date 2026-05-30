from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class MaterialResponse(BaseModel):
    id: int
    user_id: int
    original_name: str
    mime_type: str
    file_size: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
