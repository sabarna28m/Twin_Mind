from datetime import datetime
from typing import List
from pydantic import BaseModel, field_validator


class MentorMessage(BaseModel):
    role: str
    content: str

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        if v not in ("user", "assistant"):
            raise ValueError("role must be 'user' or 'assistant'")
        return v


class MentorChatRequest(BaseModel):
    message: str
    history: List[MentorMessage] = []


class HistoryMessage(BaseModel):
    role: str
    content: str


class ChatSessionSummary(BaseModel):
    id: int
    title: str
    message_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class StudyPlanSaveRequest(BaseModel):
    plan_text: str


class StudyPlanResponse(BaseModel):
    id: int
    plan_text: str
    created_at: datetime

    class Config:
        from_attributes = True
