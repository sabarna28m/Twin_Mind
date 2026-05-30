from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class StudentProfileCreate(BaseModel):
    institution: str
    course: str
    semester: str
    academic_goals: Optional[str] = ""
    learning_preferences: Optional[str] = ""  # comma-separated


class StudentProfileUpdate(BaseModel):
    institution: Optional[str] = None
    course: Optional[str] = None
    semester: Optional[str] = None
    academic_goals: Optional[str] = None
    learning_preferences: Optional[str] = None


class StudentProfileResponse(BaseModel):
    id: int
    user_id: int
    institution: str
    course: str
    semester: str
    academic_goals: str
    learning_preferences: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
