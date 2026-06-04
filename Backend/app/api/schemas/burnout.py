from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, field_validator


class BurnoutCheckIn(BaseModel):
    date: date
    study_hours: float
    sleep_hours: float
    breaks_taken: int
    study_streak_days: int = 0
    mood_rating: int    # 1–5
    energy_level: int   # 1–5

    @field_validator("mood_rating", "energy_level")
    @classmethod
    def validate_rating(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Must be between 1 and 5")
        return v

    @field_validator("study_hours", "sleep_hours")
    @classmethod
    def validate_hours(cls, v: float) -> float:
        if not 0 <= v <= 24:
            raise ValueError("Must be between 0 and 24")
        return v

    @field_validator("breaks_taken", "study_streak_days")
    @classmethod
    def validate_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Must be non-negative")
        return v


class BurnoutResponse(BaseModel):
    id: int
    user_id: int
    date: date
    study_hours: float
    sleep_hours: float
    breaks_taken: int
    study_streak_days: int
    mood_rating: int
    energy_level: int
    burnout_score: int
    risk_level: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BurnoutTrendPoint(BaseModel):
    date: date
    burnout_score: int
    risk_level: str


class BurnoutAnalysis(BaseModel):
    entry: BurnoutResponse
    recommendations: List[str]
    twin_message: str
    alerts: List[str]
