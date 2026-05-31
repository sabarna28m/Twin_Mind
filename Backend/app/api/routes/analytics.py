from datetime import date, datetime, timedelta, timezone
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.models.session import Session
from app.models.note import Note
from app.models.material import Material
from app.models.learning_data import LearningData
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.api.schemas.analytics import AnalyticsResponse, SubjectStat, DayActivity
from app.api.schemas.analytics_summary import (
    AnalyticsSummaryResponse, HeatmapDay, WeekSummary, MonthSummary,
    SubjectPerf, BestWorstWeek,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsResponse)
def get_analytics(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    sessions = db.query(Session).filter(Session.user_id == current_user.id).all()
    notes_count = db.query(Note).filter(Note.user_id == current_user.id).count()
    materials_count = db.query(Material).filter(Material.user_id == current_user.id).count()

    completed = [s for s in sessions if s.status == "completed"]
    active = [s for s in sessions if s.status == "active"]
    total_minutes = sum(s.duration_minutes or 0 for s in sessions)

    # Subject breakdown
    subject_map: dict[str, dict] = defaultdict(lambda: {"count": 0, "minutes": 0})
    for s in sessions:
        key = s.subject or "Other"
        subject_map[key]["count"] += 1
        subject_map[key]["minutes"] += s.duration_minutes or 0
    subjects = [
        SubjectStat(subject=k, count=v["count"], total_minutes=v["minutes"])
        for k, v in sorted(subject_map.items(), key=lambda x: -x[1]["count"])
    ]

    # Daily activity — last 14 days
    today = datetime.now(timezone.utc).date()
    day_map: dict[str, dict] = {
        str(today - timedelta(days=i)): {"sessions": 0, "minutes": 0}
        for i in range(13, -1, -1)
    }
    for s in sessions:
        if s.created_at:
            day = str(s.created_at.astimezone(timezone.utc).date())
            if day in day_map:
                day_map[day]["sessions"] += 1
                day_map[day]["minutes"] += s.duration_minutes or 0
    activity = [DayActivity(date=d, sessions=v["sessions"], minutes=v["minutes"]) for d, v in day_map.items()]

    return AnalyticsResponse(
        total_sessions=len(sessions),
        completed_sessions=len(completed),
        active_sessions=len(active),
        total_study_minutes=total_minutes,
        total_notes=notes_count,
        total_materials=materials_count,
        subjects=subjects,
        activity_last_14_days=activity,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Helpers for summary endpoint
# ──────────────────────────────────────────────────────────────────────────────

def _ld_score(e: LearningData) -> float:
    """Overall score for a LearningData entry (mirrors twin.py logic)."""
    academic_parts = [
        min(e.study_hours / 6.0, 1.0) * 100,
        e.attendance_percentage,
        e.assignment_completion_rate,
    ]
    if e.quiz_scores is not None:
        academic_parts.append(e.quiz_scores)
    if e.exam_scores is not None:
        academic_parts.append(e.exam_scores)
    academic = sum(academic_parts) / len(academic_parts)
    sleep_score = max(0.0, 100.0 - abs(e.sleep_duration - 7.5) * 15.0)
    stress_score = (10 - e.stress_level) / 9.0 * 100
    wellness = (sleep_score + stress_score) / 2.0
    return round(0.6 * academic + 0.4 * wellness, 1)


@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    today = datetime.now(timezone.utc).date()

    entries = (
        db.query(LearningData)
        .filter(LearningData.user_id == current_user.id)
        .order_by(LearningData.date.asc())
        .all()
    )

    entry_map: dict[date, LearningData] = {e.date: e for e in entries}

    # ── Heatmap: last 90 days ─────────────────────────────────────────────
    heatmap: list[HeatmapDay] = []
    for i in range(89, -1, -1):
        d = today - timedelta(days=i)
        e = entry_map.get(d)
        heatmap.append(HeatmapDay(
            date=str(d),
            score=_ld_score(e) if e else 0.0,
            has_entry=e is not None,
        ))

    # ── Weekly summaries: last 12 weeks ──────────────────────────────────
    days_since_monday = today.weekday()
    this_monday = today - timedelta(days=days_since_monday)
    weekly_summaries: list[WeekSummary] = []
    for w in range(11, -1, -1):
        week_start = this_monday - timedelta(weeks=w)
        week_end = week_start + timedelta(days=6)
        week_entries = [e for e in entries if week_start <= e.date <= week_end]
        if not week_entries:
            continue
        n = len(week_entries)
        ws, we = week_start, week_end
        if ws.month == we.month:
            label = f"{ws.strftime('%b')} {ws.day}–{we.day}"
        else:
            label = f"{ws.strftime('%b')} {ws.day}–{we.strftime('%b')} {we.day}"
        weekly_summaries.append(WeekSummary(
            week_start=str(week_start),
            week_label=label,
            overall_score=round(sum(_ld_score(e) for e in week_entries) / n, 1),
            study_hours=round(sum(e.study_hours for e in week_entries) / n, 1),
            attendance=round(sum(e.attendance_percentage for e in week_entries) / n, 1),
            sleep_duration=round(sum(e.sleep_duration for e in week_entries) / n, 1),
            stress_level=round(sum(e.stress_level for e in week_entries) / n, 1),
            entry_count=n,
        ))

    # ── Monthly summaries: last 6 months ─────────────────────────────────
    monthly_summaries: list[MonthSummary] = []
    for m_offset in range(5, -1, -1):
        year, month = today.year, today.month - m_offset
        while month <= 0:
            month += 12
            year -= 1
        month_entries = [e for e in entries if e.date.year == year and e.date.month == month]
        lbl = date(year, month, 1).strftime('%b %Y')
        if not month_entries:
            monthly_summaries.append(MonthSummary(
                month=f"{year}-{month:02d}", month_label=lbl,
                overall_score=0.0, study_hours=0.0, attendance=0.0, entry_count=0,
            ))
            continue
        n = len(month_entries)
        monthly_summaries.append(MonthSummary(
            month=f"{year}-{month:02d}", month_label=lbl,
            overall_score=round(sum(_ld_score(e) for e in month_entries) / n, 1),
            study_hours=round(sum(e.study_hours for e in month_entries) / n, 1),
            attendance=round(sum(e.attendance_percentage for e in month_entries) / n, 1),
            entry_count=n,
        ))

    # ── Subject performance: from study Sessions ──────────────────────────
    session_rows = db.query(Session).filter(Session.user_id == current_user.id).all()
    subj_map: dict[str, dict] = defaultdict(lambda: {"count": 0, "minutes": 0})
    for s in session_rows:
        key = s.subject or "Other"
        subj_map[key]["count"] += 1
        subj_map[key]["minutes"] += s.duration_minutes or 0
    subject_performance = [
        SubjectPerf(subject=k, sessions=v["count"], total_minutes=v["minutes"])
        for k, v in sorted(subj_map.items(), key=lambda x: -x[1]["count"])
    ]

    # ── Best / worst week ─────────────────────────────────────────────────
    best_week: Optional[BestWorstWeek] = None
    worst_week: Optional[BestWorstWeek] = None
    if weekly_summaries:
        best = max(weekly_summaries, key=lambda w: w.overall_score)
        worst = min(weekly_summaries, key=lambda w: w.overall_score)
        best_week = BestWorstWeek(week_label=best.week_label, overall_score=best.overall_score)
        worst_week = BestWorstWeek(week_label=worst.week_label, overall_score=worst.overall_score)

    # ── Aggregates ────────────────────────────────────────────────────────
    n_all = len(entries)
    avg_study = round(sum(e.study_hours for e in entries) / n_all, 1) if n_all else 0.0
    avg_sleep = round(sum(e.sleep_duration for e in entries) / n_all, 1) if n_all else 0.0
    avg_stress = round(sum(e.stress_level for e in entries) / n_all, 1) if n_all else 0.0

    # ── Streaks ───────────────────────────────────────────────────────────
    current_streak = 0
    check_day = today if today in entry_map else today - timedelta(days=1)
    while check_day in entry_map:
        current_streak += 1
        check_day -= timedelta(days=1)

    longest_streak = 0
    if entries:
        dates = sorted(entry_map.keys())
        streak = 1
        longest_streak = 1
        for i in range(1, len(dates)):
            if (dates[i] - dates[i - 1]).days == 1:
                streak += 1
                if streak > longest_streak:
                    longest_streak = streak
            else:
                streak = 1

    return AnalyticsSummaryResponse(
        heatmap=heatmap,
        weekly_summaries=weekly_summaries,
        monthly_summaries=monthly_summaries,
        subject_performance=subject_performance,
        best_week=best_week,
        worst_week=worst_week,
        total_checkins=n_all,
        avg_study_hours=avg_study,
        avg_sleep_duration=avg_sleep,
        avg_stress_level=avg_stress,
        current_streak=current_streak,
        longest_streak=longest_streak,
    )
