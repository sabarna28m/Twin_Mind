from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class LearningDataCreate(BaseModel):
    date: date
    study_hours: float
    attendance_percentage: float
    assignment_completion_rate: float
    quiz_scores: Optional[float] = None
    exam_scores: Optional[float] = None
    sleep_duration: float
    stress_level: int
    notes: Optional[str] = ""

    @field_validator("attendance_percentage", "assignment_completion_rate")
    @classmethod
    def validate_percentage(cls, v: float) -> float:
        if not 0 <= v <= 100:
            raise ValueError("Must be between 0 and 100")
        return v

    @field_validator("quiz_scores", "exam_scores")
    @classmethod
    def validate_score(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not 0 <= v <= 100:
            raise ValueError("Must be between 0 and 100")
        return v

    @field_validator("stress_level")
    @classmethod
    def validate_stress(cls, v: int) -> int:
        if not 1 <= v <= 10:
            raise ValueError("Must be between 1 and 10")
        return v

    @field_validator("study_hours", "sleep_duration")
    @classmethod
    def validate_hours(cls, v: float) -> float:
        if not 0 <= v <= 24:
            raise ValueError("Must be between 0 and 24")
        return v


class LearningDataUpdate(BaseModel):
    study_hours: Optional[float] = None
    attendance_percentage: Optional[float] = None
    assignment_completion_rate: Optional[float] = None
    quiz_scores: Optional[float] = None
    exam_scores: Optional[float] = None
    sleep_duration: Optional[float] = None
    stress_level: Optional[int] = None
    notes: Optional[str] = None


class LearningDataResponse(BaseModel):
    id: int
    user_id: int
    date: date
    study_hours: float
    attendance_percentage: float
    assignment_completion_rate: float
    quiz_scores: Optional[float] = None
    exam_scores: Optional[float] = None
    sleep_duration: float
    stress_level: int
    notes: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
