from typing import List, Optional
from pydantic import BaseModel, field_validator


class PredictionRequest(BaseModel):
    study_hours: float
    attendance_percentage: float
    assignment_completion_rate: float
    quiz_scores: Optional[float] = None
    stress_level: int
    sleep_duration: float

    @field_validator("attendance_percentage", "assignment_completion_rate")
    @classmethod
    def pct(cls, v: float) -> float:
        if not 0 <= v <= 100:
            raise ValueError("Must be 0–100")
        return v

    @field_validator("quiz_scores")
    @classmethod
    def quiz(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not 0 <= v <= 100:
            raise ValueError("Must be 0–100")
        return v

    @field_validator("stress_level")
    @classmethod
    def stress(cls, v: int) -> int:
        if not 1 <= v <= 10:
            raise ValueError("Must be 1–10")
        return v

    @field_validator("study_hours", "sleep_duration")
    @classmethod
    def hours(cls, v: float) -> float:
        if not 0 <= v <= 24:
            raise ValueError("Must be 0–24")
        return v


class PredictionResponse(BaseModel):
    predicted_score: float
    risk_level: str                 # low | medium | high
    risk_label: str                 # human-readable label
    confidence_range: List[float]   # [low, high] ±uncertainty
    recommendations: List[str]
    feature_contributions: dict     # relative impact of each feature
