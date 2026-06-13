from typing import Optional
from pydantic import BaseModel


class MetricComparison(BaseModel):
    actual: float
    predicted: float
    accuracy: float        # 0–100
    unit: str
    label: str
    better_than_predicted: bool
    diff: float            # actual − predicted


class PredictionEvent(BaseModel):
    date: str
    metric: str
    predicted: float
    actual: float
    accuracy: float
    unit: str
    description: str


class WeeklyAccuracy(BaseModel):
    week_label: str
    accuracy: float
    data_points: int


class ChartPoint(BaseModel):
    date: str
    actual: float
    predicted: float


class TwinComparisonResponse(BaseModel):
    has_sufficient_data: bool
    data_points: int

    # Current-snapshot comparisons (most recent entry vs rolling prediction)
    study_hours: MetricComparison
    quiz_score: Optional[MetricComparison] = None
    focus_sessions: MetricComparison
    notes_created: MetricComparison
    consistency: MetricComparison
    knowledge_growth: MetricComparison

    # Aggregate accuracy
    twin_accuracy_score: float
    accuracy_delta: Optional[float] = None   # change vs previous period

    # AI-generated narrative insights
    ai_insights: list[str]

    # Notable prediction events (sorted newest-first)
    prediction_history: list[PredictionEvent]

    # Week-by-week accuracy trend
    accuracy_trend: list[WeeklyAccuracy]

    # Twin learning status
    learning_status: str          # learning_fast | learning_patterns | insufficient_data
    learning_status_label: str
    learning_status_detail: str

    # Qualitative difference analysis
    exceeded_predictions: list[str]
    missed_predictions: list[str]
    twin_incorrect_assumptions: list[str]
    newly_learned_patterns: list[str]

    # Confidence breakdown
    prediction_confidence: float
    confidence_factors: list[str]

    # Time-series for charts
    study_hours_series: list[ChartPoint]
    quiz_score_series: list[ChartPoint]
    focus_sessions_series: list[ChartPoint]
