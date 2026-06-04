from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, field_validator


class TopicInput(BaseModel):
    name: str
    score: float

    @field_validator("score")
    @classmethod
    def validate_score(cls, v: float) -> float:
        if not 0 <= v <= 100:
            raise ValueError("Score must be 0–100")
        return v


class SubjectRecordCreate(BaseModel):
    subject: str
    date: date
    score: float
    study_hours: float = 0.0
    confidence: int = 3
    source: str = "manual"
    topics: List[TopicInput] = []
    notes: str = ""

    @field_validator("score")
    @classmethod
    def validate_score(cls, v: float) -> float:
        if not 0 <= v <= 100:
            raise ValueError("Score must be 0–100")
        return v

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Confidence must be 1–5")
        return v

    @field_validator("study_hours")
    @classmethod
    def validate_hours(cls, v: float) -> float:
        if not 0 <= v <= 24:
            raise ValueError("Must be 0–24")
        return v


class TopicSummary(BaseModel):
    name: str
    score: float
    risk: str   # strong / average / weak


class ScorePoint(BaseModel):
    date: date
    score: float
    source: str


class SubjectSummary(BaseModel):
    subject: str
    avg_score: float
    latest_score: float
    previous_score: Optional[float] = None
    improvement: Optional[float] = None
    study_hours: float
    confidence: float
    last_activity: Optional[date] = None
    days_since_activity: Optional[int] = None
    trend: str                  # improving / declining / stable
    risk_level: str             # strong / average / weak
    topics: List[TopicSummary] = []
    score_history: List[ScorePoint] = []
    recommended_daily_minutes: int = 60


class ActionPlanDay(BaseModel):
    day: int
    title: str
    task: str


class PriorityItem(BaseModel):
    rank: int
    subject: str
    avg_score: float
    risk_level: str
    priority_label: str


class SubjectRecordResponse(BaseModel):
    id: int
    user_id: int
    subject: str
    date: date
    score: float
    study_hours: float
    confidence: int
    source: str
    topics: List[TopicSummary] = []
    notes: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SubjectAnalysisResponse(BaseModel):
    subjects: List[SubjectSummary] = []
    weakest: Optional[SubjectSummary] = None
    strongest: Optional[SubjectSummary] = None
    most_improved: Optional[SubjectSummary] = None
    neglected: Optional[SubjectSummary] = None
    focus_today: Optional[SubjectSummary] = None
    recommendations: Dict[str, List[str]] = {}
    action_plans: Dict[str, List[Dict[str, Any]]] = {}
    notifications: List[str] = []
    priority_ranking: List[PriorityItem] = []
