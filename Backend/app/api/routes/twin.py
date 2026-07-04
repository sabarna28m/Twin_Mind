import statistics
from collections import defaultdict
from datetime import date as DateType
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.models.user import User
from app.models.learning_data import LearningData
from app.models.note import Note
from app.models.session import Session as StudySession
from app.models.quiz import QuizSession
from app.models.subject_performance import SubjectRecord
from app.api.routes.auth import get_current_user
from app.api.schemas.twin import (
    TwinState, TwinHistoryPoint, FutureTwin,
    CognitiveHeatmap, EvolutionEvent,
)
from app.api.schemas.twin_comparison import (
    TwinComparisonResponse, MetricComparison, PredictionEvent,
    WeeklyAccuracy, ChartPoint,
)
from app.ml.predictor import predict

router = APIRouter(prefix="/twin", tags=["twin"])


# ── Score helpers ──────────────────────────────────────────────────────────

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
    academic  = sum(academic_parts) / len(academic_parts)
    sleep     = _sleep_score(entry.sleep_duration)
    stress    = _stress_score(entry.stress_level)
    wellness  = (sleep + stress) / 2.0
    overall   = 0.6 * academic + 0.4 * wellness
    return {
        "academic":     round(academic,  1),
        "wellness":     round(wellness,  1),
        "overall":      round(overall,   1),
        "study":        round(_study_score(entry.study_hours), 1),
        "attendance":   round(entry.attendance_percentage,     1),
        "assignments":  round(entry.assignment_completion_rate, 1),
        "sleep":        round(sleep,  1),
        "stress":       round(stress, 1),
    }

def _knowledge_growth(entry: LearningData) -> float:
    return round(min(100.0, _study_score(entry.study_hours) * 0.5 + entry.assignment_completion_rate * 0.5), 1)

def _consistency_level(entry: LearningData) -> float:
    return round(entry.attendance_percentage * 0.6 + entry.assignment_completion_rate * 0.4, 1)

def _focus_quality(entry: LearningData) -> float:
    return round(_study_score(entry.study_hours) * 0.6 + _stress_score(entry.stress_level) * 0.4, 1)

def _tis(entry: LearningData, scored: dict) -> float:
    return round(
        scored["academic"] * 0.35
        + _knowledge_growth(entry) * 0.25
        + _consistency_level(entry) * 0.20
        + _focus_quality(entry) * 0.20,
        1,
    )


# ── AI explanation ─────────────────────────────────────────────────────────

def _ai_explanation(
    curr: float,
    prev: Optional[float],
    entry: LearningData,
    notes: int,
    sessions: int,
    quiz_acc: Optional[float],
) -> str:
    if prev is None:
        return "Twin initialized — your first learning data point has been recorded."
    delta = curr - prev
    if abs(delta) < 1:
        if entry.study_hours >= 4:
            return f"Score held steady. Consistent {entry.study_hours:.1f}h study sessions are maintaining performance."
        return "Score held steady — no major shifts in learning patterns detected."
    if delta > 0:
        if quiz_acc is not None and quiz_acc >= 75:
            return f"Score rose {delta:.0f} pts. Quiz accuracy at {quiz_acc:.0f}% and {entry.study_hours:.1f}h study time drove this growth."
        if entry.study_hours >= 5:
            return f"Score climbed {delta:.0f} pts. High study intensity ({entry.study_hours:.1f}h) significantly boosted knowledge growth."
        if notes > 0:
            return f"Score improved {delta:.0f} pts. Active note-taking ({notes} notes) and learning engagement accelerated twin growth."
        if entry.attendance_percentage >= 85:
            return f"Score increased {delta:.0f} pts. Strong attendance ({entry.attendance_percentage:.0f}%) and consistent effort are paying off."
        return f"Score improved by {delta:.0f} pts through better overall learning engagement."
    else:
        if entry.stress_level >= 7:
            return f"Score dropped {abs(delta):.0f} pts. High stress ({entry.stress_level}/10) reduced learning effectiveness and focus quality."
        if entry.study_hours < 2:
            return f"Score fell {abs(delta):.0f} pts. Low study time ({entry.study_hours:.1f}h) reduced knowledge reinforcement."
        if entry.attendance_percentage < 60:
            return f"Score declined {abs(delta):.0f} pts. Attendance fell to {entry.attendance_percentage:.0f}%, limiting learning exposure."
        return f"Score decreased {abs(delta):.0f} pts. Reduced activity and engagement contributed to this dip."


# ── Timeline builder ───────────────────────────────────────────────────────

def _build_evolution_timeline(history: list[TwinHistoryPoint]) -> list[EvolutionEvent]:
    events: list[EvolutionEvent] = []
    for i, pt in enumerate(history):
        delta = pt.score_delta
        if i == 0:
            events.append(EvolutionEvent(date=pt.date, icon="", description="Twin was born — learning journey started."))
            continue
        if delta is None:
            continue
        if delta >= 10:
            events.append(EvolutionEvent(date=pt.date, icon="", description=f"Major growth — twin intelligence surged by {delta:.0f} points. {pt.ai_explanation}"))
        elif delta >= 5:
            events.append(EvolutionEvent(date=pt.date, icon="", description=f"Significant improvement of {delta:.0f} points. {pt.ai_explanation}"))
        elif delta <= -10:
            events.append(EvolutionEvent(date=pt.date, icon="", description=f"Sharp decline of {abs(delta):.0f} points. {pt.ai_explanation}"))
        elif delta <= -5:
            events.append(EvolutionEvent(date=pt.date, icon="", description=f"Score dropped {abs(delta):.0f} points. {pt.ai_explanation}"))
        elif pt.quiz_accuracy is not None and pt.quiz_accuracy >= 85:
            events.append(EvolutionEvent(date=pt.date, icon="", description=f"Excellent quiz performance at {pt.quiz_accuracy:.0f}% — memory strength improved."))
        elif pt.study_hours >= 5:
            events.append(EvolutionEvent(date=pt.date, icon="", description=f"High learning activity — {pt.study_hours:.1f}h of study powered twin growth."))
    # newest first, max 8
    return list(reversed(events))[:8]


# ── Cognitive heatmap ──────────────────────────────────────────────────────

def _build_cognitive_heatmap(
    entries: list,
    scored: list,
    quiz_avg_by_date: dict,
) -> CognitiveHeatmap:
    n = len(entries)
    knowledge_areas = round(sum(s["academic"] for s in scored) / n, 1)

    quiz_vals = list(quiz_avg_by_date.values())
    memory_strength = round(sum(quiz_vals) / len(quiz_vals), 1) if quiz_vals else \
        round(sum(s["assignments"] for s in scored) / n, 1)

    stress_vals = [float(e.stress_level) for e in entries]
    if len(stress_vals) > 1:
        std = statistics.stdev(stress_vals)
        focus_stability = round(max(0.0, 100.0 - std * 12.0), 1)
    else:
        focus_stability = round((10 - stress_vals[0]) / 9 * 100, 1)

    overalls = [s["overall"] for s in scored]
    slope = _linear_slope(overalls)
    learning_speed = round(min(100.0, max(0.0, 50.0 + slope * 5.0)), 1)

    first_date = entries[0].date
    last_date  = entries[-1].date
    span = max(1, (last_date - first_date).days)
    ideal = max(1.0, span / 7.0 * 3.0)
    pred_confidence = round(min(100.0, (n / ideal) * 80.0), 1)

    return CognitiveHeatmap(
        knowledge_areas=knowledge_areas,
        memory_strength=memory_strength,
        focus_stability=focus_stability,
        learning_speed=learning_speed,
        prediction_confidence=pred_confidence,
    )


# ── AI insights ────────────────────────────────────────────────────────────

def _build_ai_insights(
    tis: float,
    trend: str,
    heatmap: CognitiveHeatmap,
    consistency_score: float,
    data_points: int,
) -> list[str]:
    insights: list[str] = []

    if trend == "improving":
        prob = min(95, round(tis * 0.9 + 5))
        insights.append(f"The twin predicts a {prob}% chance of maintaining or improving current performance based on your trajectory.")
    elif trend == "declining":
        prob = max(30, round(tis * 0.6))
        insights.append(f"Current trend suggests a {prob}% probability of stabilizing if study consistency is restored this week.")
    else:
        prob = round(min(90, tis * 0.85 + 10))
        insights.append(f"The twin estimates a {prob}% chance of maintaining current performance with existing habits.")

    dims = {
        "Focus Stability": heatmap.focus_stability,
        "Knowledge Retention": heatmap.knowledge_areas,
        "Memory Strength": heatmap.memory_strength,
        "Learning Speed": heatmap.learning_speed,
    }
    weakest = min(dims, key=dims.get)
    if heatmap.learning_speed > heatmap.memory_strength:
        insights.append("Focus quality is improving faster than knowledge retention — add review sessions to consolidate new learning.")
    else:
        insights.append(f"Knowledge retention is building well, but {weakest.lower()} needs attention to unlock the next maturity level.")

    if consistency_score >= 70:
        insights.append("Learning consistency is the strongest contributor to twin growth — your regular study pattern is building a strong foundation.")
    elif consistency_score < 45:
        insights.append("Consistency is the key bottleneck — even 3 regular check-ins per week would significantly accelerate twin development.")
    else:
        strongest = max(dims, key=dims.get)
        insights.append(f"Moderate consistency detected. Targeting {strongest.lower()} more regularly could push twin intelligence above 80.")

    if data_points < 5:
        insights.append("More check-ins will sharpen the twin's predictions — aim for 3 per week to reach full prediction confidence.")
    elif data_points >= 20:
        insights.append(f"With {data_points} data points, the twin's behavioral model is highly reliable and predictions carry strong confidence.")

    return insights[:4]


# ── Classification helpers ─────────────────────────────────────────────────

def _maturity_level(twin_age: int, data_points: int) -> int:
    if twin_age < 7 or data_points < 3:
        return 1
    if twin_age < 30 or data_points < 10:
        return 2
    if twin_age < 90 or data_points < 25:
        return 3
    if twin_age < 180 or data_points < 50:
        return 4
    return 5

def _state_label(trend: str, overall: float, consistency: float) -> str:
    if trend == "improving" and overall >= 70:
        return "Thriving Learner"
    if trend == "improving":
        return "Growth Mode"
    if trend == "stable" and overall >= 70:
        return "Adaptive Learner"
    if trend == "stable" and overall >= 50:
        return "Steady Performer"
    if trend == "declining" and consistency >= 60:
        return "Resilient Learner"
    if trend == "declining":
        return "Under Pressure"
    return "Building Momentum"

def _behavior_understanding(data_points: int) -> str:
    if data_points < 5:   return "Low"
    if data_points < 15:  return "Moderate"
    if data_points < 30:  return "High"
    return "Expert"


# ── Math helpers ───────────────────────────────────────────────────────────

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


# ── Future twin builder ────────────────────────────────────────────────────

def _build_motivation(trend: str, delta: float, entry: LearningData, days: int = 30) -> tuple[str, list[str]]:
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
            msg = f"Two months of consistent effort will shift your score by {delta:+.0f} points. The habits you lock in now will define your exam performance."
            tips = tips[:2] or ["Set a weekly review session to measure progress.", "Aim to raise your weakest metric by 10 points before the 60-day mark."]
        elif trend == "declining":
            msg = "A 60-day window is enough to fully reverse a downward trend. Pick two habits and track them weekly."
            tips = tips[:3] or ["Set a weekly check-in goal.", "Pair study sessions with a consistent schedule to rebuild discipline."]
        else:
            msg = "Sixty days of targeted improvement can move you from stable to thriving. Focus on two weakest metrics."
            tips = tips[:3] or ["Schedule two study blocks per day.", "Track attendance weekly — a 5% improvement compounds into a meaningful score bump."]
    elif days == 90:
        if trend == "improving":
            msg = f"Ninety days of your current trajectory means a {delta:+.0f}-point overall shift — a transformation, not just progress."
            tips = tips[:2] or ["Set a 90-day goal card and review it every Sunday.", "Mentor a peer — teaching reinforces mastery."]
        elif trend == "declining":
            msg = "Three months is more than enough to rebuild. One focused week of habit repair compounds into a completely different outcome."
            tips = tips[:3] or ["Break the 90 days into three 30-day sprints.", "Review twin data every two weeks and adjust focus accordingly."]
        else:
            msg = "A 90-day commitment to intentional improvement separates good students from great ones. Your base is solid — now build the ceiling."
            tips = tips[:3] or ["Block a dedicated deep-work hour daily.", "Use the first two weeks of each month to set targets; the last two to review them."]
    else:
        if trend == "improving":
            msg = f"You're building real momentum. Keep these habits for 30 days and your overall score will shift by {delta:+.0f} points."
            tips = tips[:2] or ["Keep logging daily to maintain this streak.", "Challenge yourself to push attendance above 90%."]
        elif trend == "declining":
            msg = "Your twin is on a downward trend. The good news: improving just one habit is enough to reverse the direction."
            tips = tips[:3] or ["Pick your single lowest metric and focus only on that for one week.", "Log a check-in every day this week to rebuild consistency."]
        else:
            msg = "Your twin is holding steady. Targeting your weakest area could shift you from stable to improving within two weeks."
            tips = tips[:3] or ["Increase study hours by 30 minutes a day.", "Focus on your lowest-scoring metric — even a 10-point gain changes risk level."]
    return msg, tips


def _compute_future_twin(
    entries: list, scored: list, twin_age: int, trend: str, overall_score: float, days: int = 30,
) -> Optional[FutureTwin]:
    n = len(entries)
    if n == 0:
        return None
    days_per_entry = (twin_age / (n - 1)) if n > 1 else 1.0
    ea = days / max(days_per_entry, 1.0)

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
    f_academic  = sum(a_parts) / len(a_parts)
    f_wellness  = (_sleep_score(p_sleep) + _stress_score(p_stress)) / 2.0
    f_overall   = 0.6 * f_academic + 0.4 * f_wellness

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
            study_hours=p_study, attendance_percentage=p_attend,
            assignment_completion_rate=p_assign, quiz_scores=p_quiz,
            stress_level=int(p_stress), sleep_duration=p_sleep,
        )
        pred_exam = round(float(result["predicted_score"]), 1)
    except Exception:
        pass

    f_risk = "low" if f_overall >= 70 else ("medium" if f_overall >= 50 else "high")
    delta  = f_overall - overall_score
    msg, tips = _build_motivation(trend, delta, entries[-1], days=days)
    return FutureTwin(
        overall_score=round(f_overall, 1), consistency_score=f_consist,
        wellness_score=round(f_wellness, 1), academic_score=round(f_academic, 1),
        risk_level=f_risk, predicted_exam_score=pred_exam,
        motivational_message=msg, tips=tips,
    )


# ── Main route ─────────────────────────────────────────────────────────────

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
            overall_score=0, consistency_score=0, wellness_score=0, academic_score=0,
            risk_level="high", trend="stable", twin_age=0, data_points=0,
            strengths=[], areas_to_improve=["Log your first check-in to activate your Digital Twin"],
            history=[],
        )

    n = len(entries)
    scored = [_entry_scores(e) for e in entries]

    # ── Bulk cross-domain queries (avoid N+1) ──
    all_notes    = db.query(Note).filter(Note.user_id == current_user.id).all()
    all_sessions = db.query(StudySession).filter(
        StudySession.user_id == current_user.id,
        StudySession.status == "completed",
    ).all()
    all_quizzes  = db.query(QuizSession).filter(QuizSession.user_id == current_user.id).all()

    # Group by date string
    notes_by_date: dict[str, int] = {}
    for note in all_notes:
        if note.created_at:
            d = str(note.created_at.date())
            notes_by_date[d] = notes_by_date.get(d, 0) + 1

    sessions_by_date: dict[str, int] = {}
    for sess in all_sessions:
        if sess.created_at:
            d = str(sess.created_at.date())
            sessions_by_date[d] = sessions_by_date.get(d, 0) + 1

    quiz_raw_by_date: dict[str, list[float]] = {}
    for quiz in all_quizzes:
        if quiz.created_at and quiz.score is not None and quiz.total and quiz.total > 0:
            d = str(quiz.created_at.date())
            quiz_raw_by_date.setdefault(d, []).append(round(quiz.score / quiz.total * 100, 1))
    quiz_avg_by_date = {d: round(sum(v) / len(v), 1) for d, v in quiz_raw_by_date.items()}

    # ── Aggregate scores ──
    overall_score    = round(sum(s["overall"]  for s in scored) / n, 1)
    academic_score   = round(sum(s["academic"] for s in scored) / n, 1)
    wellness_score   = round(sum(s["wellness"] for s in scored) / n, 1)

    first_date = entries[0].date
    last_date  = entries[-1].date
    twin_age   = (last_date - first_date).days + 1

    if n == 1:
        consistency_score = 50.0
    else:
        days_span      = twin_age
        ideal_count    = max(1, days_span / 7 * 3)
        frequency_score = min(100.0, (n / ideal_count) * 100)
        overalls        = [s["overall"] for s in scored]
        std_dev         = statistics.stdev(overalls)
        stability_score = max(0.0, 100.0 - (std_dev / 25.0) * 100)
        consistency_score = round((frequency_score + stability_score) / 2, 1)

    risk_level = "low" if overall_score >= 70 else ("medium" if overall_score >= 50 else "high")

    if n < 3:
        trend = "stable"
    else:
        mid          = n // 2
        recent_avg   = sum(s["overall"] for s in scored[mid:]) / len(scored[mid:])
        earlier_avg  = sum(s["overall"] for s in scored[:mid]) / len(scored[:mid])
        d            = recent_avg - earlier_avg
        trend        = "improving" if d >= 5 else ("declining" if d <= -5 else "stable")

    # ── Strengths / areas ──
    latest = scored[-1]
    named  = {
        "Study Consistency": latest["study"],
        "Attendance":        latest["attendance"],
        "Assignments":       latest["assignments"],
        "Sleep Quality":     latest["sleep"],
        "Stress Management": latest["stress"],
    }
    if entries[-1].quiz_scores is not None:
        named["Quiz Performance"] = entries[-1].quiz_scores
    sorted_metrics    = sorted(named.items(), key=lambda x: x[1], reverse=True)
    strengths         = [name for name, sc in sorted_metrics if sc >= 70][:3]
    areas_to_improve  = [name for name, sc in sorted_metrics if sc < 60][:3]
    if not strengths:
        strengths = [sorted_metrics[0][0]] if sorted_metrics else []
    if not areas_to_improve:
        areas_to_improve = [sorted_metrics[-1][0]] if sorted_metrics else []

    # ── Enriched history ──
    history: list[TwinHistoryPoint] = []
    tis_vals: list[float] = []
    for i, entry in enumerate(entries):
        sc       = scored[i]
        d_str    = str(entry.date)
        notes_c  = notes_by_date.get(d_str, 0)
        sess_c   = sessions_by_date.get(d_str, 0)
        quiz_acc = quiz_avg_by_date.get(d_str)

        kg   = _knowledge_growth(entry)
        cl   = _consistency_level(entry)
        fq   = _focus_quality(entry)
        tis  = _tis(entry, sc)
        tis_vals.append(tis)

        prev_score = history[-1].overall_score if history else None
        delta      = round(sc["overall"] - prev_score, 1) if prev_score is not None else None
        explanation = _ai_explanation(sc["overall"], prev_score, entry, notes_c, sess_c, quiz_acc)

        history.append(TwinHistoryPoint(
            date=d_str,
            overall_score=sc["overall"],
            twin_intelligence_score=tis,
            knowledge_growth=kg,
            consistency_level=cl,
            focus_quality=fq,
            study_hours=round(entry.study_hours, 1),
            notes_created=notes_c,
            quiz_accuracy=quiz_acc,
            focus_sessions=sess_c,
            score_delta=delta,
            ai_explanation=explanation,
        ))

    # ── New dashboard-level metrics ──
    avg_tis     = round(sum(tis_vals) / len(tis_vals), 1)
    recent_tis  = round(sum(tis_vals[-5:]) / len(tis_vals[-5:]), 1) if tis_vals else 0.0

    ideal_pts   = max(1.0, twin_age / 7.0 * 3.0)
    conf_level  = round(min(100.0, (n / ideal_pts) * 100.0), 1)

    std_tis = statistics.stdev(tis_vals) if len(tis_vals) > 1 else 0.0
    pred_rel = round(max(0.0, min(100.0, conf_level * 0.7 + (100.0 - std_tis) * 0.3)), 1)

    maturity  = _maturity_level(twin_age, n)
    state_lbl = _state_label(trend, overall_score, consistency_score)
    behav_und = _behavior_understanding(n)

    heatmap   = _build_cognitive_heatmap(entries, scored, quiz_avg_by_date)
    timeline  = _build_evolution_timeline(history)
    insights  = _build_ai_insights(recent_tis, trend, heatmap, consistency_score, n)

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
        twin_intelligence_score=recent_tis,
        confidence_level=conf_level,
        twin_maturity_level=maturity,
        prediction_reliability=pred_rel,
        behavior_understanding=behav_und,
        current_state_label=state_lbl,
        cognitive_heatmap=heatmap,
        ai_insights=insights,
        evolution_timeline=timeline,
    )


# ── Human vs Twin Comparison ───────────────────────────────────────────────

def _roll(values: list[float], i: int, window: int = 3) -> Optional[float]:
    """Rolling mean of up to `window` entries before index i. None if i==0."""
    if i == 0:
        return None
    subset = values[max(0, i - window):i]
    return statistics.mean(subset) if subset else None


def _acc(actual: float, predicted: float, scale: float) -> float:
    """Accuracy as 0–100.  scale = max expected absolute deviation."""
    if scale <= 0:
        return 100.0
    return round(max(0.0, min(100.0, 100.0 - abs(actual - predicted) / scale * 100.0)), 1)


def _mk(actual: float, predicted: float, scale: float, unit: str, label: str) -> MetricComparison:
    acc  = _acc(actual, predicted, scale)
    diff = round(actual - predicted, 2)
    return MetricComparison(
        actual=round(actual, 2), predicted=round(predicted, 2),
        accuracy=acc, unit=unit, label=label,
        better_than_predicted=diff >= 0, diff=diff,
    )


def _insufficient(n: int) -> TwinComparisonResponse:
    zero = _mk(0, 0, 1, "", "")
    return TwinComparisonResponse(
        has_sufficient_data=False, data_points=n,
        study_hours=zero, focus_sessions=zero, notes_created=zero,
        consistency=zero, knowledge_growth=zero,
        twin_accuracy_score=0.0,
        ai_insights=["Log at least 2 check-ins to activate Human vs Twin comparison."],
        prediction_history=[], accuracy_trend=[],
        learning_status="insufficient_data",
        learning_status_label=" Insufficient Data",
        learning_status_detail="Log more check-ins so the Twin can start learning your patterns.",
        exceeded_predictions=[], missed_predictions=[],
        twin_incorrect_assumptions=[], newly_learned_patterns=[],
        prediction_confidence=0.0, confidence_factors=[],
        study_hours_series=[], quiz_score_series=[], focus_sessions_series=[],
    )


@router.get("/comparison", response_model=TwinComparisonResponse)
def get_twin_comparison(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    entries = (
        db.query(LearningData)
        .filter(LearningData.user_id == current_user.id)
        .order_by(LearningData.date.asc())
        .all()
    )
    n = len(entries)
    if n < 2:
        return _insufficient(n)

    # ── Cross-domain bulk queries ──────────────────────────
    all_notes = db.query(Note).filter(Note.user_id == current_user.id).all()
    all_sessions = (
        db.query(StudySession)
        .filter(StudySession.user_id == current_user.id, StudySession.status == "completed")
        .order_by(StudySession.created_at.asc())
        .all()
    )
    all_quizzes = (
        db.query(QuizSession)
        .filter(
            QuizSession.user_id == current_user.id,
            QuizSession.score.isnot(None),
            QuizSession.total.isnot(None),
            QuizSession.total > 0,
        )
        .order_by(QuizSession.created_at.asc())
        .all()
    )
    all_subject_recs = (
        db.query(SubjectRecord)
        .filter(SubjectRecord.user_id == current_user.id)
        .all()
    )

    # Group notes/sessions by date string (for per-entry lookup)
    notes_by_date: dict[str, int] = {}
    for note in all_notes:
        if note.created_at:
            d = str(note.created_at.date())
            notes_by_date[d] = notes_by_date.get(d, 0) + 1

    sessions_by_date: dict[str, int] = {}
    for sess in all_sessions:
        if sess.created_at:
            d = str(sess.created_at.date())
            sessions_by_date[d] = sessions_by_date.get(d, 0) + 1

    # ── Per-entry metric series ────────────────────────────
    study_s   = [e.study_hours for e in entries]
    consist_s = [e.attendance_percentage * 0.6 + e.assignment_completion_rate * 0.4 for e in entries]
    kg_s      = [min(100.0, (e.study_hours / 6.0 * 100.0) * 0.5 + e.assignment_completion_rate * 0.5) for e in entries]
    notes_s   = [float(notes_by_date.get(str(e.date), 0)) for e in entries]
    sess_s    = [float(sessions_by_date.get(str(e.date), 0)) for e in entries]

    # ── Current snapshot (last entry vs rolling prediction) ─
    i_last = n - 1

    def _pred(series: list[float]) -> float:
        r = _roll(series, i_last)
        return r if r is not None else series[0]

    study_cmp   = _mk(study_s[-1],   _pred(study_s),   max(_pred(study_s), study_s[-1], 2),   "h",        "Study Time")
    consist_cmp = _mk(consist_s[-1], _pred(consist_s), 100,                                   "%",        "Learning Consistency")
    kg_cmp      = _mk(kg_s[-1],      _pred(kg_s),      100,                                   "%",        "Knowledge Growth")
    notes_cmp   = _mk(notes_s[-1],   _pred(notes_s),   max(_pred(notes_s), notes_s[-1], 3),   "notes",    "Notes Created")
    sess_cmp    = _mk(sess_s[-1],    _pred(sess_s),     max(_pred(sess_s), sess_s[-1], 2),    "sessions", "Focus Sessions")

    # Quiz comparison
    quiz_cmp: Optional[MetricComparison] = None
    quiz_accs: list[float] = []
    for q in all_quizzes:
        if q.score is not None and q.total and q.total > 0:
            quiz_accs.append(round(q.score / q.total * 100.0, 1))
    if len(quiz_accs) >= 2:
        latest_q  = quiz_accs[-1]
        pred_q    = statistics.mean(quiz_accs[max(0, len(quiz_accs) - 4):-1])
        quiz_cmp  = _mk(latest_q, pred_q, 100, "%", "Quiz Score")

    # ── Twin Accuracy Score (weighted) ─────────────────────
    acc_weights: list[tuple[float, float]] = [
        (study_cmp.accuracy,   0.25),
        (consist_cmp.accuracy, 0.20),
        (kg_cmp.accuracy,      0.20),
        (sess_cmp.accuracy,    0.15),
        (notes_cmp.accuracy,   0.10),
    ]
    if quiz_cmp:
        acc_weights[4] = (notes_cmp.accuracy, 0.05)
        acc_weights.append((quiz_cmp.accuracy, 0.10))
    total_w = sum(w for _, w in acc_weights)
    twin_accuracy = round(sum(a * w for a, w in acc_weights) / total_w, 1) if total_w else 0.0

    # Accuracy delta: recent 3 vs prior 3 entries
    accuracy_delta: Optional[float] = None
    if n >= 6:
        def _period_acc(idx_range: range) -> float:
            accs = []
            for i in idx_range:
                pr = _roll(study_s, i)
                if pr is not None:
                    accs.append(_acc(study_s[i], pr, max(study_s[i], pr, 1)))
            return statistics.mean(accs) if accs else 50.0
        recent_acc = _period_acc(range(max(1, n - 3), n))
        older_acc  = _period_acc(range(max(1, n - 6), max(1, n - 3)))
        accuracy_delta = round(recent_acc - older_acc, 1)

    # ── Time-series for charts ─────────────────────────────
    study_chart: list[ChartPoint] = []
    sess_chart:  list[ChartPoint] = []
    quiz_chart:  list[ChartPoint] = []

    for i, entry in enumerate(entries):
        d   = str(entry.date)
        pr_s = _roll(study_s, i)
        pr_e = _roll(sess_s,  i)
        study_chart.append(ChartPoint(
            date=d, actual=round(study_s[i], 2),
            predicted=round(pr_s, 2) if pr_s is not None else round(study_s[i], 2),
        ))
        sess_chart.append(ChartPoint(
            date=d, actual=sess_s[i],
            predicted=round(pr_e, 2) if pr_e is not None else sess_s[i],
        ))

    for j, quiz in enumerate(all_quizzes):
        pr_q = _roll(quiz_accs, j)
        d = str(quiz.created_at.date()) if quiz.created_at else str(DateType.today())
        quiz_chart.append(ChartPoint(
            date=d, actual=round(quiz_accs[j], 1),
            predicted=round(pr_q, 1) if pr_q is not None else round(quiz_accs[j], 1),
        ))

    # ── Prediction history events ──────────────────────────
    events: list[PredictionEvent] = []

    for i in range(2, n):
        pr = _roll(study_s, i)
        if pr is None:
            continue
        acc = _acc(study_s[i], pr, max(study_s[i], pr, 1))
        if acc < 72:
            diff = study_s[i] - pr
            verb = f"exceeded prediction by {diff:.1f}h" if diff > 0 else f"fell {abs(diff):.1f}h short of prediction"
            events.append(PredictionEvent(
                date=str(entries[i].date), metric="Study Time",
                predicted=round(pr, 1), actual=round(study_s[i], 1),
                accuracy=acc, unit="h",
                description=f"Logged {study_s[i]:.1f}h — Twin predicted {pr:.1f}h. You {verb}.",
            ))

    for j in range(1, len(quiz_accs)):
        pr = _roll(quiz_accs, j)
        if pr is None:
            continue
        acc = _acc(quiz_accs[j], pr, 100)
        if acc < 78:
            diff = quiz_accs[j] - pr
            verb = f"exceeded prediction by {diff:.0f}%" if diff > 0 else f"came in {abs(diff):.0f}% below prediction"
            events.append(PredictionEvent(
                date=str(all_quizzes[j].created_at.date()) if all_quizzes[j].created_at else str(DateType.today()),
                metric="Quiz Score",
                predicted=round(pr, 1), actual=round(quiz_accs[j], 1),
                accuracy=acc, unit="%",
                description=f"Quiz accuracy {quiz_accs[j]:.0f}% — Twin predicted {pr:.0f}%. You {verb}.",
            ))

    events.sort(key=lambda e: e.date, reverse=True)
    events = events[:8]

    # ── Weekly accuracy trend ──────────────────────────────
    week_accs_map: dict[str, list[float]] = defaultdict(list)
    week_cnt_map:  dict[str, int]         = defaultdict(int)

    for i in range(1, n):
        pr = _roll(study_s, i)
        if pr is None:
            continue
        acc = _acc(study_s[i], pr, max(study_s[i], pr, 1))
        iso = entries[i].date.isocalendar()
        key = f"{iso[0]}-W{iso[1]:02d}"
        week_accs_map[key].append(acc)
        week_cnt_map[key] += 1

    accuracy_trend: list[WeeklyAccuracy] = []
    for idx, (wk, acc_list) in enumerate(sorted(week_accs_map.items())):
        accuracy_trend.append(WeeklyAccuracy(
            week_label=f"Week {idx + 1}",
            accuracy=round(statistics.mean(acc_list), 1),
            data_points=week_cnt_map[wk],
        ))

    # ── Learning status ────────────────────────────────────
    if n < 3 or twin_accuracy < 40:
        ls, ls_lbl, ls_detail = (
            "insufficient_data",
            " Insufficient Data",
            "The Twin needs more check-ins to build a reliable behavioral model.",
        )
    elif twin_accuracy >= 75 and n >= 10:
        ls, ls_lbl, ls_detail = (
            "learning_fast",
            " Learning Fast",
            f"Twin has analyzed {n} behavioral data points and is accurately predicting your study patterns.",
        )
    else:
        ls, ls_lbl, ls_detail = (
            "learning_patterns",
            " Learning User Patterns",
            f"Twin has {n} data points and is actively refining its model. Accuracy improves with each check-in.",
        )

    # ── Difference analysis ────────────────────────────────
    exceeded:  list[str] = []
    missed:    list[str] = []
    incorrect: list[str] = []
    learned:   list[str] = []

    if study_cmp.diff > 0.5:
        exceeded.append(f"Study time was {study_cmp.diff:.1f}h above prediction — stronger commitment than modelled.")
    elif study_cmp.diff < -0.5:
        missed.append(f"Study time came in {abs(study_cmp.diff):.1f}h below prediction — availability may have been overestimated.")

    if quiz_cmp:
        if quiz_cmp.diff > 5:
            exceeded.append(f"Quiz accuracy beat prediction by {quiz_cmp.diff:.0f}% — comprehension is stronger than modelled.")
        elif quiz_cmp.diff < -5:
            missed.append(f"Quiz accuracy came in {abs(quiz_cmp.diff):.0f}% below prediction — knowledge gaps may be widening.")

    if sess_cmp.diff > 0.5:
        exceeded.append(f"Completed {sess_cmp.diff:.0f} more focus sessions than predicted — strong execution.")
    elif sess_cmp.diff < -0.5:
        missed.append(f"Missed {abs(sess_cmp.diff):.0f} predicted focus sessions — session frequency lower than modelled.")

    if notes_cmp.diff > 1:
        exceeded.append(f"Created {notes_cmp.diff:.0f} more notes than expected — active knowledge documentation.")

    if consist_cmp.diff < -10:
        incorrect.append(f"Consistency dropped {abs(consist_cmp.diff):.0f}% below the Twin's model — schedule disruption detected.")
    if kg_cmp.diff < -10:
        incorrect.append("Knowledge growth was slower than predicted — the Twin may have overestimated task completion rates.")

    if accuracy_delta is not None and accuracy_delta > 5:
        learned.append(f"Twin accuracy improved {accuracy_delta:.0f}% recently — behavioral model is converging.")
    if study_cmp.accuracy > 85:
        learned.append("Twin has accurately learned your typical study duration patterns.")
    if quiz_cmp and quiz_cmp.accuracy > 85:
        learned.append("Quiz performance prediction is well-calibrated to your knowledge base.")
    if sess_cmp.accuracy > 80:
        learned.append("Focus session frequency is now reliably predicted by the Twin.")

    # ── Confidence factors ─────────────────────────────────
    conf_factors: list[str] = []
    if n > 0:
        conf_factors.append(f" {n} check-in{'s' if n != 1 else ''} analyzed")
    if all_quizzes:
        conf_factors.append(f" {len(all_quizzes)} quiz session{'s' if len(all_quizzes) != 1 else ''} analyzed")
    if all_sessions:
        conf_factors.append(f" {len(all_sessions)} focus session{'s' if len(all_sessions) != 1 else ''} analyzed")
    if all_subject_recs:
        conf_factors.append(f" {len(all_subject_recs)} subject record{'s' if len(all_subject_recs) != 1 else ''} analyzed")
    if all_notes:
        conf_factors.append(f" {len(all_notes)} note{'s' if len(all_notes) != 1 else ''} catalogued")

    n_sources = len(conf_factors)
    pred_confidence = round(min(100.0, (n / 20.0) * 60.0 + n_sources * 8.0), 1)

    # ── AI insights ────────────────────────────────────────
    insights: list[str] = []

    insights.append(
        f"The Digital Twin accurately predicted {twin_accuracy:.0f}% of your recent learning behavior "
        f"across {n} behavioral data points."
    )

    if sess_cmp.diff < -0.5:
        insights.append(
            f"The Twin expected {sess_cmp.predicted:.0f} focus session{'s' if sess_cmp.predicted != 1 else ''} "
            f"but only {sess_cmp.actual:.0f} {'were' if sess_cmp.actual != 1 else 'was'} completed — "
            "consistency is the primary gap."
        )
    elif sess_cmp.diff > 0.5:
        insights.append(
            f"You completed {sess_cmp.actual:.0f} focus sessions vs the predicted {sess_cmp.predicted:.0f} — "
            "your dedication exceeded the Twin's model."
        )

    if quiz_cmp:
        sign = "+" if quiz_cmp.diff >= 0 else ""
        insights.append(
            f"Quiz performance came in {sign}{quiz_cmp.diff:.0f}% vs the Twin's prediction of {quiz_cmp.predicted:.0f}% — "
            f"{'exceeding' if quiz_cmp.diff >= 0 else 'below'} expectations."
        )

    if study_cmp.accuracy < 70:
        insights.append(
            f"Study hours showed high variance ({study_cmp.accuracy:.0f}% accuracy) — "
            "the Twin is adjusting its schedule model to reflect actual availability."
        )

    if accuracy_delta is not None:
        if accuracy_delta > 3:
            insights.append(
                f"Twin prediction accuracy improved {accuracy_delta:.0f}% over recent sessions — "
                "the behavioral model is converging on your patterns."
            )
        elif accuracy_delta < -3:
            insights.append(
                f"Prediction accuracy dipped {abs(accuracy_delta):.0f}% recently — "
                "a behavioral pattern shift may be occurring; more data will re-calibrate the model."
            )

    return TwinComparisonResponse(
        has_sufficient_data=True,
        data_points=n,
        study_hours=study_cmp,
        quiz_score=quiz_cmp,
        focus_sessions=sess_cmp,
        notes_created=notes_cmp,
        consistency=consist_cmp,
        knowledge_growth=kg_cmp,
        twin_accuracy_score=twin_accuracy,
        accuracy_delta=accuracy_delta,
        ai_insights=insights[:5],
        prediction_history=events,
        accuracy_trend=accuracy_trend,
        learning_status=ls,
        learning_status_label=ls_lbl,
        learning_status_detail=ls_detail,
        exceeded_predictions=exceeded,
        missed_predictions=missed,
        twin_incorrect_assumptions=incorrect,
        newly_learned_patterns=learned,
        prediction_confidence=pred_confidence,
        confidence_factors=conf_factors,
        study_hours_series=study_chart,
        quiz_score_series=quiz_chart,
        focus_sessions_series=sess_chart,
    )
