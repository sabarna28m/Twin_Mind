from typing import Literal, Optional
from pydantic import BaseModel


class TwinHistoryPoint(BaseModel):
    date: str
    overall_score: float
    twin_intelligence_score: float = 0.0
    knowledge_growth: float = 0.0
    consistency_level: float = 0.0
    focus_quality: float = 0.0
    study_hours: float = 0.0
    notes_created: int = 0
    quiz_accuracy: Optional[float] = None
    focus_sessions: int = 0
    score_delta: Optional[float] = None
    ai_explanation: str = ""


class CognitiveHeatmap(BaseModel):
    knowledge_areas: float
    memory_strength: float
    focus_stability: float
    learning_speed: float
    prediction_confidence: float


class EvolutionEvent(BaseModel):
    date: str
    icon: str
    description: str


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
    # Digital Twin Evolution Dashboard fields
    twin_intelligence_score: float = 0.0
    confidence_level: float = 0.0
    twin_maturity_level: int = 1
    prediction_reliability: float = 0.0
    behavior_understanding: str = "Low"
    current_state_label: str = "Initializing"
    cognitive_heatmap: Optional[CognitiveHeatmap] = None
    ai_insights: list[str] = []
    evolution_timeline: list[EvolutionEvent] = []
