from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, field_validator


class StudentProfileCreate(BaseModel):
    institution: str
    course: str
    semester: str
    academic_goals: Optional[str] = ""
    learning_preferences: Optional[str] = ""  # comma-separated
    subjects: List[str] = []


class StudentProfileUpdate(BaseModel):
    institution: Optional[str] = None
    course: Optional[str] = None
    semester: Optional[str] = None
    academic_goals: Optional[str] = None
    learning_preferences: Optional[str] = None
    subjects: Optional[List[str]] = None


class StudentProfileResponse(BaseModel):
    id: int
    user_id: int
    institution: str
    course: str
    semester: str
    academic_goals: str
    learning_preferences: str
    subjects: List[str] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_validator("subjects", mode="before")
    @classmethod
    def parse_subjects(cls, v):
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        if isinstance(v, list):
            return v
        return []

    model_config = {"from_attributes": True}
