from typing import List, Optional
from pydantic import BaseModel


class HeatmapDay(BaseModel):
    date: str
    score: float
    has_entry: bool


class WeekSummary(BaseModel):
    week_start: str
    week_label: str
    overall_score: float
    study_hours: float
    attendance: float
    sleep_duration: float
    stress_level: float
    entry_count: int


class MonthSummary(BaseModel):
    month: str
    month_label: str
    overall_score: float
    study_hours: float
    attendance: float
    entry_count: int


class SubjectPerf(BaseModel):
    subject: str
    sessions: int
    total_minutes: int


class BestWorstWeek(BaseModel):
    week_label: str
    overall_score: float


class AnalyticsSummaryResponse(BaseModel):
    heatmap: List[HeatmapDay]
    weekly_summaries: List[WeekSummary]
    monthly_summaries: List[MonthSummary]
    subject_performance: List[SubjectPerf]
    best_week: Optional[BestWorstWeek] = None
    worst_week: Optional[BestWorstWeek] = None
    total_checkins: int
    avg_study_hours: float
    avg_sleep_duration: float
    avg_stress_level: float
    current_streak: int
    longest_streak: int
