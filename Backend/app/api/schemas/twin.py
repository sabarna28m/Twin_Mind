from typing import Literal
from pydantic import BaseModel


class TwinHistoryPoint(BaseModel):
    date: str
    overall_score: float


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
