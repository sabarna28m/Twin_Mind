from typing import List
from pydantic import BaseModel


class SubjectStat(BaseModel):
    subject: str
    count: int
    total_minutes: int


class DayActivity(BaseModel):
    date: str        # YYYY-MM-DD
    sessions: int
    minutes: int


class AnalyticsResponse(BaseModel):
    total_sessions: int
    completed_sessions: int
    active_sessions: int
    total_study_minutes: int
    total_notes: int
    total_materials: int
    subjects: List[SubjectStat]
    activity_last_14_days: List[DayActivity]
