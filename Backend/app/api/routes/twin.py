import statistics
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func

from app.core.database import get_db
from app.models.user import User
from app.models.learning_data import LearningData
from app.models.session import Session as StudySession
from app.models.burnout import BurnoutEntry
from app.models.subject_performance import SubjectRecord
from app.models.student_profile import StudentProfile
from app.models.quiz import QuizSession
from app.api.routes.auth import get_current_user
from app.api.schemas.twin import (
    TwinState, TwinHistoryPoint, FutureTwin,
    DigitalTwinProfile, SimulationResults, ScenarioResult,
    KnowledgeGraphData, KnowledgeNode, KnowledgeEdge,
    TwinSnapshot, ForecastResult,
)
from app.ml.predictor import predict

router = APIRouter(prefix="/twin", tags=["twin"])

# ── Subject relationship map for knowledge graph edges ─────────────────
SUBJECT_EDGES: dict[str, list[str]] = {
    "Mathematics":      ["Physics", "Computer Science", "Statistics", "Economics"],
    "Physics":          ["Mathematics", "Chemistry", "Engineering"],
    "Chemistry":        ["Physics", "Biology"],
    "Biology":          ["Chemistry"],
    "Computer Science": ["Mathematics", "Data Science", "Algorithms"],
    "Data Science":     ["Mathematics", "Computer Science", "Statistics"],
    "Statistics":       ["Mathematics", "Data Science", "Economics"],
    "English":          ["Literature", "Communication"],
    "Literature":       ["English"],
    "Engineering":      ["Physics", "Mathematics"],
    "Economics":        ["Mathematics", "Statistics"],
    "Algorithms":       ["Computer Science", "Mathematics"],
    "DBMS":             ["Computer Science"],
    "Operating Systems":["Computer Science"],
    "Networks":         ["Computer Science"],
    "Java":             ["Computer Science", "Algorithms"],
    "Python":           ["Computer Science", "Data Science"],
    "DSA":              ["Computer Science", "Algorithms"],
}


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
    trend: str, delta: float, entry: LearningData, days: int = 30
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

    if days == 60:
        if trend == "improving":
            msg = (
                f"Two months of consistent effort will shift your score by {delta:+.0f} points. "
                f"The habits you lock in now will define your exam performance this semester."
            )
            tips = tips[:2] or [
                "Set a weekly review session to measure your progress against last month.",
                "Aim to raise your weakest metric by 10 points before the 60-day mark.",
            ]
        elif trend == "declining":
            msg = (
                "A 60-day window is enough to fully reverse a downward trend. "
                "Pick the two habits that need the most work and track them every week — "
                "small corrections now prevent a much harder climb later."
            )
            tips = tips[:3] or [
                "Set a weekly check-in goal and treat missing it like missing class.",
                "Pair study sessions with a consistent schedule to rebuild discipline.",
            ]
        else:
            msg = (
                "Sixty days of targeted improvement can move you from stable to thriving. "
                "Focus on your two weakest metrics and review them bi-weekly — "
                "steady increments beat occasional bursts."
            )
            tips = tips[:3] or [
                "Schedule two study blocks per day to gradually increase your hours.",
                "Track attendance weekly — a 5% improvement compunds into a meaningful score bump.",
            ]
    elif days == 90:
        if trend == "improving":
            msg = (
                f"Ninety days of your current trajectory means a {delta:+.0f}-point overall shift — "
                f"a transformation, not just progress. This is the window where habits become identity."
            )
            tips = tips[:2] or [
                "Set a 90-day goal card: write your target scores and review it every Sunday.",
                "Mentor a peer — teaching reinforces your own mastery and keeps you accountable.",
            ]
        elif trend == "declining":
            msg = (
                "Three months is a full academic quarter — more than enough time to rebuild from here. "
                "One focused week of habit repair will compound into a completely different outcome "
                "by the end of this projection."
            )
            tips = tips[:3] or [
                "Break the 90 days into three 30-day sprints, each with a single target habit.",
                "Review your twin data every two weeks and adjust your focus area accordingly.",
            ]
        else:
            msg = (
                "A 90-day commitment to intentional improvement is what separates good students from great ones. "
                "Your base is solid — now build the ceiling. Consistent effort over this window "
                "can move you an entire risk level."
            )
            tips = tips[:3] or [
                "Block out a dedicated deep-work hour daily — protect it like an exam slot.",
                "Use the first two weeks of each month to set targets; the last two to review them.",
            ]
    else:  # 30 days (default)
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
    days: int = 30,
) -> Optional[FutureTwin]:
    n = len(entries)
    if n == 0:
        return None

    days_per_entry = (twin_age / (n - 1)) if n > 1 else 1.0
    ea = days / max(days_per_entry, 1.0)  # entries equivalent to `days` days ahead

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
    future_span = twin_age + days
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
    msg, tips = _build_motivation(trend, delta, entries[-1], days=days)

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

    future_30 = _compute_future_twin(entries, scored, twin_age, trend, overall_score, days=30)
    future_60 = _compute_future_twin(entries, scored, twin_age, trend, overall_score, days=60)
    future_90 = _compute_future_twin(entries, scored, twin_age, trend, overall_score, days=90)

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
        future_twin=future_30,
        future_twin_60=future_60,
        future_twin_90=future_90,
    )


# ═══════════════════════════════════════════════════════════════════════
#  NEW DIGITAL TWIN ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

def _maturity(n: int) -> tuple[str, float]:
    if n < 5:
        return "Seed",      min(20.0, n * 4.0)
    if n < 15:
        return "Growing",   20.0 + (n - 5) * 2.0
    if n < 30:
        return "Developing",40.0 + (n - 15) * 1.33
    if n < 60:
        return "Mature",    60.0 + (n - 30) * 0.67
    return     "Advanced",  min(100.0, 80.0 + (n - 60) * 0.5)


def _risk(score: float) -> str:
    if score >= 70:  return "low"
    if score >= 50:  return "medium"
    return "high"


@router.get("/profile", response_model=DigitalTwinProfile)
def get_twin_profile(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    uid = current_user.id

    # Learning data
    ld_rows = (
        db.query(LearningData)
        .filter(LearningData.user_id == uid)
        .order_by(LearningData.date.asc())
        .all()
    )
    n = len(ld_rows)

    # Subject records → knowledge scores
    subj_rows = db.query(SubjectRecord).filter(SubjectRecord.user_id == uid).all()
    subj_map: dict[str, list[float]] = {}
    for r in subj_rows:
        subj_map.setdefault(r.subject, []).append(r.score)
    knowledge_scores = {k: round(sum(v) / len(v), 1) for k, v in subj_map.items()}

    # Quiz sessions
    quiz_rows = (
        db.query(QuizSession)
        .filter(QuizSession.user_id == uid, QuizSession.score.isnot(None))
        .all()
    )
    quiz_accuracy = 0.0
    if quiz_rows:
        acc_vals = [
            (q.score / q.total * 100) for q in quiz_rows
            if q.total and q.total > 0
        ]
        quiz_accuracy = round(sum(acc_vals) / len(acc_vals), 1) if acc_vals else 0.0

    # Focus / study sessions
    sess_rows = (
        db.query(StudySession)
        .filter(StudySession.user_id == uid, StudySession.status == "completed")
        .all()
    )
    focus_duration_avg = 0.0
    if sess_rows:
        focus_duration_avg = round(sum(s.duration_minutes or 0 for s in sess_rows) / len(sess_rows), 1)

    # Burnout risk (latest entry)
    burnout_row = (
        db.query(BurnoutEntry)
        .filter(BurnoutEntry.user_id == uid)
        .order_by(BurnoutEntry.date.desc())
        .first()
    )
    burnout_risk = float(burnout_row.burnout_score) if burnout_row else 30.0

    # Study consistency
    twin_age = 1
    if n > 1:
        twin_age = max(1, (ld_rows[-1].date - ld_rows[0].date).days + 1)
    ideal_count = max(1.0, twin_age / 7.0 * 3.0)
    study_consistency = round(min(100.0, (n / ideal_count) * 100.0), 1)

    # Engagement score (composite)
    quiz_eng    = min(100.0, len(quiz_rows) * 8.0)
    session_eng = min(100.0, len(sess_rows) * 5.0)
    checkin_eng = min(100.0, n * 7.0)
    subj_eng    = min(100.0, len(subj_rows) * 4.0)
    engagement_score = round((quiz_eng + session_eng + checkin_eng + subj_eng) / 4.0, 1)

    # Twin maturity
    twin_maturity, maturity_pct = _maturity(n)

    # Learning velocity (study hours trend per entry)
    learning_speed = 0.0
    if n >= 4:
        half = n // 2
        recent_avg  = sum(e.study_hours for e in ld_rows[half:]) / (n - half)
        earlier_avg = sum(e.study_hours for e in ld_rows[:half]) / half
        if earlier_avg > 0:
            learning_speed = round((recent_avg - earlier_avg) / earlier_avg * 100.0, 1)

    # Retention rate (quiz accuracy × consistency proxy)
    retention_rate = round(quiz_accuracy * 0.7 + study_consistency * 0.3, 1)

    # Prediction confidence
    prediction_confidence = round(min(95.0, n * 2.5 + len(quiz_rows) * 1.5), 1)

    # Learning velocity index (normalised to -100…+100)
    learning_velocity = round(max(-100.0, min(100.0, learning_speed)), 1)

    return DigitalTwinProfile(
        knowledge_scores=knowledge_scores,
        learning_speed=learning_speed,
        retention_rate=retention_rate,
        quiz_accuracy=quiz_accuracy,
        focus_duration_avg=focus_duration_avg,
        burnout_risk=burnout_risk,
        study_consistency=study_consistency,
        engagement_score=engagement_score,
        twin_maturity=twin_maturity,
        maturity_pct=round(maturity_pct, 1),
        learning_velocity=learning_velocity,
        prediction_confidence=prediction_confidence,
        total_study_sessions=len(sess_rows),
        total_quiz_attempts=len(quiz_rows),
    )


@router.get("/simulate-scenarios", response_model=SimulationResults)
def simulate_scenarios(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    uid = current_user.id
    ld_rows = (
        db.query(LearningData)
        .filter(LearningData.user_id == uid)
        .order_by(LearningData.date.desc())
        .limit(7)
        .all()
    )

    # Compute current average baseline
    if ld_rows:
        avg_attend = sum(e.attendance_percentage for e in ld_rows) / len(ld_rows)
        avg_assign = sum(e.assignment_completion_rate for e in ld_rows) / len(ld_rows)
        avg_quiz   = [e.quiz_scores for e in ld_rows if e.quiz_scores is not None]
        avg_quiz   = sum(avg_quiz) / len(avg_quiz) if avg_quiz else 60.0
        avg_stress = sum(e.stress_level for e in ld_rows) / len(ld_rows)
        avg_sleep  = sum(e.sleep_duration for e in ld_rows) / len(ld_rows)
        avg_study  = sum(e.study_hours for e in ld_rows) / len(ld_rows)
    else:
        avg_attend = 75.0; avg_assign = 70.0; avg_quiz = 60.0
        avg_stress = 5.0;  avg_sleep  = 7.0;  avg_study = 2.0

    def _predict_safe(**kwargs) -> float:
        try:
            result = predict(**kwargs)
            return round(float(result["predicted_score"]), 1)
        except Exception:
            return 60.0

    current_score = _predict_safe(
        study_hours=avg_study, attendance_percentage=avg_attend,
        assignment_completion_rate=avg_assign, quiz_scores=avg_quiz,
        stress_level=int(avg_stress), sleep_duration=avg_sleep,
    )

    # ── Four scenarios ─────────────────────────────────────────────────
    scenarios_def = [
        {
            "id": "one_hour",
            "label": "Study 1hr/Day",
            "emoji": "📚",
            "description": "Minimal study effort — 1 focused hour daily",
            "kwargs": dict(study_hours=1.0, attendance_percentage=avg_attend,
                          assignment_completion_rate=avg_assign, quiz_scores=avg_quiz,
                          stress_level=int(avg_stress), sleep_duration=avg_sleep),
            "impacts": ["Low study time limits depth", "Attendance still maintained",
                        "Risk of falling behind over time"],
            "recommendation": "Suitable only for light weeks. Increase to 3+ hrs before exams.",
        },
        {
            "id": "three_hours",
            "label": "Study 3hrs/Day",
            "emoji": "🔥",
            "description": "Optimal deep work — 3 focused hours daily",
            "kwargs": dict(study_hours=3.0, attendance_percentage=avg_attend,
                          assignment_completion_rate=avg_assign, quiz_scores=avg_quiz,
                          stress_level=int(avg_stress), sleep_duration=avg_sleep),
            "impacts": ["Strong knowledge consolidation", "Quiz accuracy likely to improve",
                        "Sustainable with good sleep hygiene"],
            "recommendation": "This is the sweet spot. Pair with daily check-ins for best results.",
        },
        {
            "id": "skip_week",
            "label": "Skip a Week",
            "emoji": "😴",
            "description": "Zero study for 7 days — burnout break or disruption",
            "kwargs": dict(study_hours=0.0, attendance_percentage=max(0, avg_attend - 20),
                          assignment_completion_rate=max(0, avg_assign - 30),
                          quiz_scores=max(0, avg_quiz - 15),
                          stress_level=min(10, int(avg_stress) + 2), sleep_duration=avg_sleep),
            "impacts": ["Significant score drop predicted", "Assignment backlog accumulates",
                        "Difficult to recover without immediate action"],
            "recommendation": "Avoid unless necessary. If unavoidable, plan an aggressive catch-up week immediately after.",
        },
        {
            "id": "ai_plan",
            "label": "Follow AI Plan",
            "emoji": "🤖",
            "description": "Optimal AI-recommended study routine",
            "kwargs": dict(study_hours=5.0, attendance_percentage=min(100, avg_attend + 10),
                          assignment_completion_rate=min(100, avg_assign + 15),
                          quiz_scores=min(100, avg_quiz + 12),
                          stress_level=max(1, int(avg_stress) - 2), sleep_duration=7.5),
            "impacts": ["Maximum academic performance", "Improved stress management",
                        "Optimal sleep boosts retention by 40%", "Consistent quiz practice closes knowledge gaps"],
            "recommendation": "Follow for 3 weeks to see measurable improvement in your Twin Health Score.",
        },
    ]

    scenario_results: list[ScenarioResult] = []
    for s in scenarios_def:
        score = _predict_safe(**s["kwargs"])
        delta = round(score - current_score, 1)
        delta_pct = round((delta / current_score * 100) if current_score > 0 else 0, 1)
        scenario_results.append(ScenarioResult(
            id=s["id"],
            label=s["label"],
            emoji=s["emoji"],
            description=s["description"],
            predicted_score=score,
            risk_level=_risk(score),
            delta_from_current=delta,
            delta_pct=delta_pct,
            key_impacts=s["impacts"],
            recommendation=s["recommendation"],
        ))

    return SimulationResults(
        current_score=current_score,
        current_risk=_risk(current_score),
        scenarios=scenario_results,
    )


@router.get("/knowledge-graph", response_model=KnowledgeGraphData)
def get_knowledge_graph(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    uid = current_user.id

    # Get subjects from student profile
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == uid).first()
    profile_subjects = []
    if profile and profile.subjects:
        profile_subjects = [s.strip() for s in profile.subjects.split(",") if s.strip()]

    # Get subjects from subject records
    subj_rows = db.query(SubjectRecord).filter(SubjectRecord.user_id == uid).all()
    subj_map: dict[str, list[float]] = {}
    subj_count: dict[str, int] = {}
    subj_date: dict[str, str] = {}
    for r in subj_rows:
        subj_map.setdefault(r.subject, []).append(r.score)
        subj_count[r.subject] = subj_count.get(r.subject, 0) + 1
        subj_date[r.subject] = str(r.date)

    # Merge profile subjects with recorded subjects
    all_subjects = list(set(profile_subjects) | set(subj_map.keys()))

    # If no subjects found, provide defaults
    if not all_subjects:
        all_subjects = ["Mathematics", "Physics", "Computer Science", "English", "Chemistry"]

    nodes: list[KnowledgeNode] = []
    for subj in all_subjects:
        scores = subj_map.get(subj, [])
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
        records = subj_count.get(subj, 0)
        if avg_score == 0 and records == 0:
            mastery = "not_started"
        elif avg_score >= 75:
            mastery = "strong"
        elif avg_score >= 50:
            mastery = "average"
        else:
            mastery = "weak"
        nodes.append(KnowledgeNode(
            id=subj.lower().replace(" ", "_"),
            label=subj,
            score=avg_score,
            mastery=mastery,
            records=records,
            last_updated=subj_date.get(subj),
        ))

    # Build edges from relation map
    seen_edges: set[frozenset] = set()
    edges: list[KnowledgeEdge] = []
    subject_set = {n.label for n in nodes}
    for node in nodes:
        related = SUBJECT_EDGES.get(node.label, [])
        for target in related:
            if target in subject_set:
                key = frozenset([node.id, target.lower().replace(" ", "_")])
                if key not in seen_edges:
                    seen_edges.add(key)
                    edges.append(KnowledgeEdge(
                        source=node.id,
                        target=target.lower().replace(" ", "_"),
                    ))

    maturity_pct = min(100.0, len(nodes) * 8.0 + len(subj_rows) * 1.5)
    return KnowledgeGraphData(nodes=nodes, edges=edges, maturity_pct=round(maturity_pct, 1))


@router.get("/snapshots", response_model=list[TwinSnapshot])
def get_snapshots(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    uid = current_user.id
    ld_rows = (
        db.query(LearningData)
        .filter(LearningData.user_id == uid)
        .order_by(LearningData.date.asc())
        .all()
    )
    if not ld_rows:
        return []

    today = date.today()
    snapshots: list[TwinSnapshot] = []
    checkpoints = [
        (today,                    "Today"),
        (today - timedelta(days=7), "7 days ago"),
        (today - timedelta(days=30),"30 days ago"),
    ]

    for checkpoint_date, label in checkpoints:
        # Use all entries up to checkpoint_date
        subset = [e for e in ld_rows if e.date <= checkpoint_date]
        if not subset:
            continue
        n = len(subset)
        scored = [_entry_scores(e) for e in subset]
        ov = round(sum(s["overall"]  for s in scored) / n, 1)
        ac = round(sum(s["academic"] for s in scored) / n, 1)
        we = round(sum(s["wellness"] for s in scored) / n, 1)
        if n == 1:
            cs = 50.0
        else:
            span = max(1, (subset[-1].date - subset[0].date).days + 1)
            ideal = max(1.0, span / 7.0 * 3.0)
            freq  = min(100.0, (n / ideal) * 100.0)
            stdev = statistics.stdev(s["overall"] for s in scored)
            stab  = max(0.0, 100.0 - (stdev / 25.0) * 100.0)
            cs    = round((freq + stab) / 2.0, 1)
        snapshots.append(TwinSnapshot(
            date=str(checkpoint_date),
            overall_score=ov,
            academic_score=ac,
            wellness_score=we,
            consistency_score=cs,
            risk_level=_risk(ov),
            data_points=n,
            label=label,
        ))

    return snapshots


@router.get("/forecast", response_model=ForecastResult)
def get_forecast(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    uid = current_user.id
    ld_rows = (
        db.query(LearningData)
        .filter(LearningData.user_id == uid)
        .order_by(LearningData.date.asc())
        .all()
    )
    n = len(ld_rows)
    explanations: list[str] = []

    if n == 0:
        return ForecastResult(
            exam_readiness=0.0, burnout_probability=50.0,
            failure_risk=80.0, expected_completion_pct=10.0,
            confidence=5.0, trend_direction="stable",
            explanations=["No data yet — log your first check-in to activate forecasting."],
        )

    scored = [_entry_scores(e) for e in ld_rows]
    overall_scores = [s["overall"] for s in scored]
    latest = ld_rows[-1]
    latest_s = scored[-1]

    # Exam readiness (academic score × consistency × quiz factor)
    avg_overall = sum(overall_scores) / n
    std_dev = statistics.stdev(overall_scores) if n > 1 else 20.0
    stability = max(0.0, 100.0 - (std_dev / 25.0) * 100.0)
    quiz_factor = latest.quiz_scores if latest.quiz_scores else avg_overall * 0.7
    exam_readiness = round(0.5 * latest_s["academic"] + 0.3 * stability + 0.2 * quiz_factor, 1)
    explanations.append(
        f"Exam readiness {exam_readiness:.0f}%: academic {latest_s['academic']:.0f}% × "
        f"consistency {stability:.0f}% × quiz {quiz_factor:.0f}%"
    )

    # Burnout probability
    burnout_row = (
        db.query(BurnoutEntry)
        .filter(BurnoutEntry.user_id == uid)
        .order_by(BurnoutEntry.date.desc())
        .first()
    )
    burnout_prob = float(burnout_row.burnout_score) if burnout_row else (
        max(0.0, min(100.0, (latest.stress_level / 10.0) * 70.0 + (1 - latest.sleep_duration / 8.0) * 30.0))
    )
    explanations.append(
        f"Burnout probability {burnout_prob:.0f}%: based on stress {latest.stress_level}/10 "
        f"and sleep {latest.sleep_duration:.1f}h"
    )

    # Failure risk (inverse of exam readiness, modulated by trend)
    if n >= 3:
        mid = n // 2
        trend_delta = (
            sum(overall_scores[mid:]) / len(overall_scores[mid:]) -
            sum(overall_scores[:mid]) / len(overall_scores[:mid])
        )
        trend = "improving" if trend_delta >= 5 else ("declining" if trend_delta <= -5 else "stable")
    else:
        trend = "stable"
        trend_delta = 0.0

    failure_base = max(0.0, 100.0 - exam_readiness)
    trend_mod = -15.0 if trend == "improving" else (15.0 if trend == "declining" else 0.0)
    failure_risk = round(max(0.0, min(100.0, failure_base + trend_mod)), 1)
    explanations.append(
        f"Failure risk {failure_risk:.0f}%: trend is {trend} "
        f"({trend_delta:+.1f} points over last {n} entries)"
    )

    # Expected completion percentage
    twin_age = max(1, (ld_rows[-1].date - ld_rows[0].date).days + 1)
    ideal_sem_days = 120  # typical semester
    completion = round(min(100.0, (twin_age / ideal_sem_days * 100.0) * (avg_overall / 100.0)), 1)
    explanations.append(
        f"Expected completion {completion:.0f}%: {twin_age} days tracked "
        f"at {avg_overall:.0f}% average performance"
    )

    # Confidence based on data richness
    confidence = round(min(95.0, n * 2.5 + (1 if burnout_row else 0) * 5.0), 1)

    return ForecastResult(
        exam_readiness=exam_readiness,
        burnout_probability=round(burnout_prob, 1),
        failure_risk=failure_risk,
        expected_completion_pct=completion,
        confidence=confidence,
        trend_direction=trend,
        explanations=explanations,
    )
