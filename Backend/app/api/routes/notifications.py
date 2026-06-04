import json
import logging
from datetime import date as DateType, timedelta
from statistics import mean
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from groq import Groq
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from app.core.config import settings
from app.core.database import get_db
from app.models.burnout import BurnoutEntry
from app.models.learning_data import LearningData
from app.models.notification import Notification
from app.models.quiz import QuizSession
from app.models.student_profile import StudentProfile
from app.models.subject_performance import SubjectRecord
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.api.routes.gamification import compute_progress
from app.api.schemas.notification import NotificationResponse
from app.services.notifications import (
    _create, maybe_notify_low_checkin, maybe_notify_weekly_summary,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["notifications"])

_groq_client: Optional[Groq] = None


def _get_groq() -> Groq:
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq(api_key=settings.groq_api_key)
    return _groq_client


# ── Pydantic models ────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    focus_score: Optional[float] = None
    focus_sessions_count: Optional[int] = None


class DailySummaryResponse(BaseModel):
    headline: str
    bullets: List[str]
    mood_emoji: str
    recommendation: str
    study_hours: float
    focus_score: Optional[float]
    streak: int
    burnout_risk: str
    best_subject: Optional[str]
    weakest_subject: Optional[str]
    xp_earned: int


# ── Helpers ────────────────────────────────────────────────────────────────

def _build_student_snapshot(
    user: User,
    db: DBSession,
    focus_score: Optional[float] = None,
    focus_sessions: Optional[int] = None,
) -> dict:
    today = DateType.today()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    # Learning data
    entries = db.query(LearningData).filter(LearningData.user_id == user.id).all()
    recent = [e for e in entries if e.date >= week_ago]
    avg_hours = round(mean(e.study_hours for e in recent), 1) if recent else 0
    days_since = (today - max((e.date for e in entries), default=today)).days if entries else 99

    # Streak
    gam = compute_progress(user.id, db)
    streak = gam["streak_days"]
    xp = gam["xp"]
    level = gam["level"]
    level_name = gam["level_name"]
    xp_to_next = gam["xp_to_next"]

    # Burnout
    burnout_entries = (
        db.query(BurnoutEntry)
        .filter(BurnoutEntry.user_id == user.id, BurnoutEntry.date >= week_ago)
        .order_by(BurnoutEntry.date.desc())
        .all()
    )
    latest_burnout = burnout_entries[0] if burnout_entries else None
    burnout_risk = latest_burnout.risk_level if latest_burnout else "unknown"
    burnout_score = latest_burnout.burnout_score if latest_burnout else 0
    sleep_hours = latest_burnout.sleep_hours if latest_burnout else 7
    mood = latest_burnout.mood_rating if latest_burnout else 3
    energy = latest_burnout.energy_level if latest_burnout else 3

    # Subject performance
    subj_records = (
        db.query(SubjectRecord)
        .filter(SubjectRecord.user_id == user.id, SubjectRecord.date >= month_ago)
        .all()
    )
    subj_map: dict[str, list[float]] = {}
    for r in subj_records:
        subj_map.setdefault(r.subject, []).append(r.score)
    subj_avgs = {s: round(mean(scores), 1) for s, scores in subj_map.items()}
    sorted_subj = sorted(subj_avgs.items(), key=lambda x: x[1])
    weakest = sorted_subj[0] if sorted_subj else None
    strongest = sorted_subj[-1] if sorted_subj else None

    # Quiz history
    quizzes = (
        db.query(QuizSession)
        .filter(QuizSession.user_id == user.id, QuizSession.score.isnot(None))
        .order_by(QuizSession.created_at.desc())
        .limit(10)
        .all()
    )
    quiz_pcts = [round(q.score / q.total * 100, 1) for q in quizzes if q.total]
    quiz_avg = round(mean(quiz_pcts), 1) if quiz_pcts else None

    # Student profile
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    subjects = []
    goals = ""
    if profile:
        try:
            subjects = json.loads(profile.subjects) if profile.subjects else []
        except Exception:
            subjects = []
        goals = getattr(profile, "academic_goals", "") or ""

    return {
        "name": user.full_name.split()[0] if user.full_name else "Student",
        "subjects": subjects,
        "goals": goals,
        "level": level,
        "level_name": level_name,
        "xp": xp,
        "xp_to_next": xp_to_next,
        "streak_days": streak,
        "avg_study_hours_7d": avg_hours,
        "days_since_last_checkin": days_since,
        "burnout_risk": burnout_risk,
        "burnout_score": burnout_score,
        "sleep_hours": sleep_hours,
        "mood_rating": mood,
        "energy_level": energy,
        "subject_scores": subj_avgs,
        "weakest_subject": weakest[0] if weakest else None,
        "weakest_score": weakest[1] if weakest else None,
        "strongest_subject": strongest[0] if strongest else None,
        "strongest_score": strongest[1] if strongest else None,
        "quiz_avg_pct": quiz_avg,
        "quiz_sessions_count": len(quizzes),
        "focus_score": focus_score,
        "focus_sessions": focus_sessions,
        "today": today.isoformat(),
    }


def _call_groq_for_notifications(snapshot: dict) -> list[dict]:
    """Call Groq and return a list of notification dicts. Returns [] on error."""
    prompt = f"""You are {snapshot['name']}'s personal AI academic twin at TwinMind.
Analyze their real data below and generate 5–7 highly personalized, actionable notifications.
Each notification MUST reference specific numbers from the data (no generic advice).

Student Data:
{json.dumps(snapshot, indent=2)}

Rules:
- priority: "critical" (burnout high, exam failing, missed deadline), "important" (weak subject, streak at risk), "informational" (XP, badges, daily update)
- category: exactly one of [study_reminder, weak_subject, burnout_alert, focus_alert, motivation, achievement, prediction]
- emoji: a single appropriate emoji
- title: max 7 words, punchy
- message: 1–2 sentences, use the student's FIRST NAME, reference actual numbers. Max 180 chars.
- action_url: the most relevant of ["/sessions", "/subjects", "/burnout", "/ai-focus", "/achievements", "/progress", "/quiz", "/checkin"] or null
- reference_key: stable deterministic key e.g. "ai_weak_physics_{snapshot['today']}"

Return ONLY a valid JSON array, no other text."""

    client = _get_groq()
    resp = client.chat.completions.create(
        model="llama3-8b-8192",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.35,
        max_tokens=1400,
    )
    raw = resp.choices[0].message.content.strip()
    # Extract JSON array from response
    start = raw.find("[")
    end = raw.rfind("]") + 1
    if start == -1 or end == 0:
        return []
    return json.loads(raw[start:end])


# ── Routes ────────────────────────────────────────────────────────────────

@router.get("", response_model=List[NotificationResponse])
def get_notifications(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    entries = (
        db.query(LearningData)
        .filter(LearningData.user_id == current_user.id)
        .all()
    )
    maybe_notify_low_checkin(db, current_user.id, entries)
    maybe_notify_weekly_summary(db, current_user.id, entries)

    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )


@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
        .count()
    )
    return {"count": count}


@router.post("/generate-ai", response_model=List[NotificationResponse])
def generate_ai_notifications(
    body: GenerateRequest = GenerateRequest(),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Aggregate student data, call Groq, persist new personalized notifications."""
    if not settings.groq_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service not configured",
        )

    snapshot = _build_student_snapshot(
        current_user, db,
        focus_score=body.focus_score,
        focus_sessions=body.focus_sessions_count,
    )

    try:
        items = _call_groq_for_notifications(snapshot)
    except Exception as e:
        logger.warning("Groq notification generation failed: %s", e)
        raise HTTPException(status_code=503, detail="AI generation temporarily unavailable")

    created: list[Notification] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        n = _create(
            db,
            user_id=current_user.id,
            notification_type=item.get("category", "ai_generated"),
            message=item.get("message", ""),
            reference_key=item.get("reference_key"),
            priority=item.get("priority", "informational"),
            category=item.get("category"),
            emoji=item.get("emoji", "🔔"),
            title=item.get("title"),
            action_url=item.get("action_url"),
        )
        if n:
            created.append(n)

    # Return all notifications (including pre-existing) sorted by priority + time
    all_notifs = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return all_notifs


@router.get("/daily-summary")
def get_daily_summary(
    focus_score: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Generate and return a fresh daily AI summary (not persisted)."""
    if not settings.groq_api_key:
        raise HTTPException(status_code=503, detail="AI service not configured")

    snapshot = _build_student_snapshot(current_user, db, focus_score=focus_score)

    prompt = f"""You are {snapshot['name']}'s AI academic twin. Generate a concise end-of-day summary.

Data: {json.dumps(snapshot)}

Return ONLY valid JSON with exactly these fields:
{{
  "headline": "one upbeat sentence (max 12 words)",
  "bullets": ["2-4 specific data-driven bullet points using actual numbers"],
  "mood_emoji": "single emoji matching overall performance",
  "recommendation": "1-2 sentence actionable advice for tomorrow",
  "study_hours": <float from data>,
  "focus_score": <float or null>,
  "streak": <int>,
  "burnout_risk": "<string>",
  "best_subject": "<string or null>",
  "weakest_subject": "<string or null>",
  "xp_earned": <estimated int>
}}"""

    try:
        client = _get_groq()
        resp = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=600,
        )
        raw = resp.choices[0].message.content.strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        result = json.loads(raw[start:end])
        return result
    except Exception as e:
        logger.warning("Daily summary generation failed: %s", e)
        # Return a fallback summary from raw data
        return {
            "headline": f"Keep going, {snapshot['name']}!",
            "bullets": [
                f"Study avg: {snapshot['avg_study_hours_7d']}h/day this week",
                f"Streak: {snapshot['streak_days']} days",
                f"Burnout risk: {snapshot['burnout_risk']}",
            ],
            "mood_emoji": "📊",
            "recommendation": "Log your check-in to keep your streak alive.",
            "study_hours": snapshot["avg_study_hours_7d"],
            "focus_score": snapshot["focus_score"],
            "streak": snapshot["streak_days"],
            "burnout_risk": snapshot["burnout_risk"],
            "best_subject": snapshot["strongest_subject"],
            "weakest_subject": snapshot["weakest_subject"],
            "xp_earned": snapshot["xp"],
        }


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not n:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    n.is_read = True
    db.commit()
    db.refresh(n)
    return n


@router.post("/read-all")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,  # noqa: E712
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(n)
    db.commit()
    return {"ok": True}
