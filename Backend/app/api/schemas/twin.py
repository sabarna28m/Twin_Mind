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


# ── Digital Twin Profile ───────────────────────────────────────────────

class DigitalTwinProfile(BaseModel):
    knowledge_scores: dict[str, float]        # subject → avg score 0-100
    learning_speed: float                      # % change in study intensity
    retention_rate: float                      # proxy from quiz trend 0-100
    quiz_accuracy: float                       # avg quiz score 0-100
    focus_duration_avg: float                  # avg session minutes
    burnout_risk: float                        # 0-100 (latest burnout score)
    study_consistency: float                   # frequency regularity 0-100
    engagement_score: float                    # composite activity 0-100
    twin_maturity: Literal['Seed', 'Growing', 'Developing', 'Mature', 'Advanced']
    maturity_pct: float                        # 0-100
    learning_velocity: float                   # score velocity per week
    prediction_confidence: float               # data richness 0-95
    total_study_sessions: int
    total_quiz_attempts: int


# ── Simulation Scenarios ───────────────────────────────────────────────

class ScenarioResult(BaseModel):
    id: str
    label: str
    emoji: str
    description: str
    predicted_score: float
    risk_level: Literal['low', 'medium', 'high']
    delta_from_current: float
    delta_pct: float
    key_impacts: list[str]
    recommendation: str


class SimulationResults(BaseModel):
    current_score: float
    current_risk: str
    scenarios: list[ScenarioResult]


# ── Knowledge Graph ────────────────────────────────────────────────────

class KnowledgeNode(BaseModel):
    id: str
    label: str
    score: float                               # 0-100, 0 = not started
    mastery: Literal['not_started', 'weak', 'average', 'strong']
    records: int                               # number of data points
    last_updated: Optional[str] = None


class KnowledgeEdge(BaseModel):
    source: str
    target: str


class KnowledgeGraphData(BaseModel):
    nodes: list[KnowledgeNode]
    edges: list[KnowledgeEdge]
    maturity_pct: float


# ── Twin Snapshot (Timeline) ───────────────────────────────────────────

class TwinSnapshot(BaseModel):
    date: str
    overall_score: float
    academic_score: float
    wellness_score: float
    consistency_score: float
    risk_level: str
    data_points: int
    label: str                                 # "Today", "7 days ago", etc.


# ── AI Forecasting ────────────────────────────────────────────────────

class ForecastResult(BaseModel):
    exam_readiness: float           # 0-100
    burnout_probability: float      # 0-100
    failure_risk: float             # 0-100
    expected_completion_pct: float  # curriculum % likely to complete
    confidence: float               # prediction confidence 0-100
    trend_direction: str            # improving/declining/stable
    explanations: list[str]         # XAI reasons for each prediction
