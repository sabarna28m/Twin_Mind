import statistics
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.models.user import User
from app.models.learning_data import LearningData
from app.api.routes.auth import get_current_user
from app.api.schemas.twin import TwinState, TwinHistoryPoint

router = APIRouter(prefix="/twin", tags=["twin"])


def _study_score(hours: float) -> float:
    return min(hours / 6.0, 1.0) * 100


def _sleep_score(hours: float) -> float:
    return max(0.0, 100.0 - abs(hours - 7.5) * 15.0)


def _stress_score(level: int) -> float:
    return (10 - level) / 9.0 * 100


def _entry_scores(entry: LearningData) -> dict:
    academic_parts = [
        _study_score(entry.study_hours),
        entry.attendance_percentage,
        entry.assignment_completion_rate,
    ]
    if entry.quiz_scores is not None:
        academic_parts.append(entry.quiz_scores)
    if entry.exam_scores is not None:
        academic_parts.append(entry.exam_scores)

    academic = sum(academic_parts) / len(academic_parts)
    sleep = _sleep_score(entry.sleep_duration)
    stress = _stress_score(entry.stress_level)
    wellness = (sleep + stress) / 2.0
    overall = 0.6 * academic + 0.4 * wellness

    return {
        "academic": round(academic, 1),
        "wellness": round(wellness, 1),
        "overall": round(overall, 1),
        "study": round(_study_score(entry.study_hours), 1),
        "attendance": round(entry.attendance_percentage, 1),
        "assignments": round(entry.assignment_completion_rate, 1),
        "sleep": round(sleep, 1),
        "stress": round(stress, 1),
    }


@router.get("", response_model=TwinState)
def get_twin(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    entries = (
        db.query(LearningData)
        .filter(LearningData.user_id == current_user.id)
        .order_by(LearningData.date.asc())
        .all()
    )

    if not entries:
        return TwinState(
            overall_score=0,
            consistency_score=0,
            wellness_score=0,
            academic_score=0,
            risk_level="high",
            trend="stable",
            twin_age=0,
            data_points=0,
            strengths=[],
            areas_to_improve=["Log your first check-in to activate your Digital Twin"],
            history=[],
        )

    n = len(entries)
    scored = [_entry_scores(e) for e in entries]

    # Averages
    overall_score = round(sum(s["overall"] for s in scored) / n, 1)
    academic_score = round(sum(s["academic"] for s in scored) / n, 1)
    wellness_score = round(sum(s["wellness"] for s in scored) / n, 1)

    # Twin age: days from first to last entry
    first_date = entries[0].date
    last_date = entries[-1].date
    twin_age = (last_date - first_date).days + 1

    # Consistency score
    if n == 1:
        consistency_score = 50.0
    else:
        days_span = twin_age
        ideal_count = max(1, days_span / 7 * 3)  # 3 check-ins per week ideal
        frequency_score = min(100.0, (n / ideal_count) * 100)
        overalls = [s["overall"] for s in scored]
        std_dev = statistics.stdev(overalls)
        stability_score = max(0.0, 100.0 - (std_dev / 25.0) * 100)
        consistency_score = round((frequency_score + stability_score) / 2, 1)

    # Risk level
    if overall_score >= 70:
        risk_level = "low"
    elif overall_score >= 50:
        risk_level = "medium"
    else:
        risk_level = "high"

    # Trend: compare recent half vs earlier half (need at least 3 entries)
    if n < 3:
        trend = "stable"
    else:
        mid = n // 2
        recent_avg = sum(s["overall"] for s in scored[mid:]) / len(scored[mid:])
        earlier_avg = sum(s["overall"] for s in scored[:mid]) / len(scored[:mid])
        delta = recent_avg - earlier_avg
        if delta >= 5:
            trend = "improving"
        elif delta <= -5:
            trend = "declining"
        else:
            trend = "stable"

    # Strengths / areas to improve from latest entry
    latest = scored[-1]
    named = {
        "Study Consistency": latest["study"],
        "Attendance": latest["attendance"],
        "Assignments": latest["assignments"],
        "Sleep Quality": latest["sleep"],
        "Stress Management": latest["stress"],
    }
    if entries[-1].quiz_scores is not None:
        named["Quiz Performance"] = entries[-1].quiz_scores

    sorted_metrics = sorted(named.items(), key=lambda x: x[1], reverse=True)
    strengths = [name for name, score in sorted_metrics if score >= 70][:3]
    areas_to_improve = [name for name, score in sorted_metrics if score < 60][:3]

    if not strengths:
        strengths = [sorted_metrics[0][0]] if sorted_metrics else []
    if not areas_to_improve:
        areas_to_improve = [sorted_metrics[-1][0]] if sorted_metrics else []

    # History for evolution chart
    history = [
        TwinHistoryPoint(date=str(entries[i].date), overall_score=scored[i]["overall"])
        for i in range(n)
    ]

    return TwinState(
        overall_score=overall_score,
        consistency_score=consistency_score,
        wellness_score=wellness_score,
        academic_score=academic_score,
        risk_level=risk_level,
        trend=trend,
        twin_age=twin_age,
        data_points=n,
        strengths=strengths,
        areas_to_improve=areas_to_improve,
        history=history,
    )
