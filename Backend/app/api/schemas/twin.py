from typing import Literal, Optional
from pydantic import BaseModel


class TwinHistoryPoint(BaseModel):
    date: str
    overall_score: float


class FutureTwin(BaseModel):
    overall_score: float
    consistency_score: float
    wellness_score: float
    academic_score: float
    risk_level: Literal['low', 'medium', 'high']
    predicted_exam_score: Optional[float] = None
    motivational_message: str
    tips: list[str]


class TwinState(BaseModel):
    overall_score: float
    consistency_score: float
    wellness_score: float
    academic_score: float
    risk_level: Literal['low', 'medium', 'high']
    trend: Literal['improving', 'declining', 'stable']
    twin_age: int
    data_points: int
    strengths: list[str]
    areas_to_improve: list[str]
    history: list[TwinHistoryPoint]
    future_twin: Optional[FutureTwin] = None
    future_twin_60: Optional[FutureTwin] = None
    future_twin_90: Optional[FutureTwin] = None
