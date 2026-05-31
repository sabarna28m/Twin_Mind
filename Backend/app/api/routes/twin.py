import statistics
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.models.user import User
from app.models.learning_data import LearningData
from app.api.routes.auth import get_current_user
from app.api.schemas.twin import TwinState, TwinHistoryPoint, FutureTwin
from app.ml.predictor import predict

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


def _linear_slope(values: list) -> float:
    n = len(values)
    if n < 2:
        return 0.0
    x_mean = (n - 1) / 2.0
    y_mean = sum(values) / n
    num = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
    den = sum((i - x_mean) ** 2 for i in range(n))
    return num / den if den else 0.0


def _project(values: list, entries_ahead: float, lo: float, hi: float) -> float:
    slope = _linear_slope(values)
    return max(lo, min(hi, values[-1] + slope * entries_ahead))


def _build_motivation(
    trend: str, delta: float, entry: LearningData
) -> tuple[str, list[str]]:
    tips: list[str] = []
    if entry.study_hours < 4:
        tips.append("Add 30 extra minutes of study per day — small increments compound fast.")
    if entry.attendance_percentage < 75:
        tips.append("Attend every class this week — attendance is one of the top predictors of exam performance.")
    if entry.assignment_completion_rate < 70:
        tips.append("Submit every assignment even if incomplete — consistency beats perfection.")
    if entry.sleep_duration < 6.5:
        tips.append("Aim for 7–8 hours of sleep — it improves memory consolidation by up to 40%.")
    if entry.stress_level >= 7:
        tips.append("Try 10 minutes of deep breathing daily — sustained high stress is a major performance drain.")

    if trend == "improving":
        msg = (
            f"You're building real momentum. Keep these habits for 30 days and your overall score "
            f"will shift by {delta:+.0f} points. Every consistent day compounds into long-term success."
        )
        tips = tips[:2] or [
            "Keep logging daily to maintain this streak.",
            "Challenge yourself to push attendance above 90%.",
        ]
    elif trend == "declining":
        msg = (
            "Your twin is on a downward trend. Without changes, scores could fall further over the next "
            "30 days. The good news: improving just one habit is enough to reverse the direction."
        )
        tips = tips[:3] or [
            "Pick your single lowest metric and focus only on that for one week.",
            "Log a check-in every day this week to rebuild consistency.",
        ]
    else:
        msg = (
            "Your twin is holding steady — a solid base to build from. Targeting your weakest area "
            "could shift you from stable to improving within two weeks."
        )
        tips = tips[:3] or [
            "Increase study hours by 30 minutes a day to break out of the plateau.",
            "Focus on your lowest-scoring metric — even a 10-point gain changes your risk level.",
        ]

    return msg, tips


def _compute_future_twin(
    entries: list,
    scored: list,
    twin_age: int,
    trend: str,
    overall_score: float,
) -> Optional[FutureTwin]:
    n = len(entries)
    if n == 0:
        return None

    days_per_entry = (twin_age / (n - 1)) if n > 1 else 1.0
    ea = 30.0 / max(days_per_entry, 1.0)  # entries equivalent to 30 days ahead

    study_v  = [e.study_hours for e in entries]
    attend_v = [e.attendance_percentage for e in entries]
    assign_v = [e.assignment_completion_rate for e in entries]
    quiz_v   = [e.quiz_scores for e in entries if e.quiz_scores is not None]
    sleep_v  = [e.sleep_duration for e in entries]
    stress_v = [float(e.stress_level) for e in entries]

    p_study  = _project(study_v,  ea, 0.0, 10.0)
    p_attend = _project(attend_v, ea, 0.0, 100.0)
    p_assign = _project(assign_v, ea, 0.0, 100.0)
    p_quiz   = _project(quiz_v,   ea, 0.0, 100.0) if quiz_v else None
    p_sleep  = _project(sleep_v,  ea, 0.0, 10.0)
    p_stress = round(_project(stress_v, ea, 1.0, 10.0))

    a_parts = [_study_score(p_study), p_attend, p_assign]
    if p_quiz is not None:
        a_parts.append(p_quiz)
    f_academic = sum(a_parts) / len(a_parts)
    f_wellness = (_sleep_score(p_sleep) + _stress_score(p_stress)) / 2.0
    f_overall  = 0.6 * f_academic + 0.4 * f_wellness

    future_n    = n + int(ea)
    future_span = twin_age + 30
    ideal       = max(1.0, future_span / 7.0 * 3.0)
    f_freq      = min(100.0, (future_n / ideal) * 100.0)
    overalls    = [s["overall"] for s in scored]
    std_dev     = statistics.stdev(overalls) if n > 1 else 0.0
    stability   = max(0.0, 100.0 - (std_dev / 25.0) * 100.0)
    f_consist   = round((f_freq + stability) / 2.0, 1)

    pred_exam: Optional[float] = None
    try:
        result = predict(
            study_hours=p_study,
            attendance_percentage=p_attend,
            assignment_completion_rate=p_assign,
            quiz_scores=p_quiz,
            stress_level=int(p_stress),
            sleep_duration=p_sleep,
        )
        pred_exam = round(float(result["predicted_score"]), 1)
    except Exception:
        pass

    if f_overall >= 70:
        f_risk = "low"
    elif f_overall >= 50:
        f_risk = "medium"
    else:
        f_risk = "high"

    delta = f_overall - overall_score
    msg, tips = _build_motivation(trend, delta, entries[-1])

    return FutureTwin(
        overall_score=round(f_overall, 1),
        consistency_score=f_consist,
        wellness_score=round(f_wellness, 1),
        academic_score=round(f_academic, 1),
        risk_level=f_risk,
        predicted_exam_score=pred_exam,
        motivational_message=msg,
        tips=tips,
    )


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

    future = _compute_future_twin(entries, scored, twin_age, trend, overall_score)

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
        future_twin=future,
    )
