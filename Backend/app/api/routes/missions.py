from datetime import date as DateType
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func

from app.core.database import get_db
from app.models.user import User
from app.models.session import Session as StudySession
from app.models.quiz import QuizSession
from app.models.learning_data import LearningData
from app.models.smart_note import SmartNote
from app.models.material import Material
from app.models.mentor_conversation import MentorConversation
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/missions", tags=["missions"])


@router.get("/progress")
def get_mission_progress(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """
    Return today's activity metrics for mission progress evaluation.
    All values derived from existing DB tables — no separate tracking store.
    """
    uid = current_user.id
    today_str = DateType.today().isoformat()          # 'YYYY-MM-DD'
    today_date = DateType.today()

    # ── Study sessions ─────────────────────────────────────────────────────
    # Sessions with duration > 0 created today represent completed timer runs.
    sessions_today = (
        db.query(StudySession)
        .filter(
            StudySession.user_id == uid,
            func.date(StudySession.created_at) == today_str,
            StudySession.duration_minutes > 0,
        )
        .all()
    )

    sessions_count = len(sessions_today)
    total_minutes = sum(s.duration_minutes or 0 for s in sessions_today)
    max_session   = max((s.duration_minutes or 0 for s in sessions_today), default=0)

    # Minutes by subject (lowercased for case-insensitive matching)
    subject_minutes: dict[str, int] = {}
    for s in sessions_today:
        if s.subject:
            k = s.subject.lower().strip()
            subject_minutes[k] = subject_minutes.get(k, 0) + (s.duration_minutes or 0)

    # ── Quizzes ────────────────────────────────────────────────────────────
    quizzes_today = (
        db.query(QuizSession)
        .filter(
            QuizSession.user_id == uid,
            func.date(QuizSession.created_at) == today_str,
        )
        .all()
    )

    quiz_count    = len(quizzes_today)
    quiz_correct  = sum(q.score or 0 for q in quizzes_today)
    quiz_total_q  = sum(q.total or 0 for q in quizzes_today)
    quiz_max_pct  = max(
        (round((q.score / q.total) * 100) for q in quizzes_today if q.total and q.score is not None),
        default=0,
    )

    # ── Wellness check-in ──────────────────────────────────────────────────
    checkin = db.query(LearningData).filter(
        LearningData.user_id == uid,
        LearningData.date == today_date,
    ).first()

    # ── Smart notes ────────────────────────────────────────────────────────
    notes_today = db.query(SmartNote).filter(
        SmartNote.user_id == uid,
        func.date(SmartNote.created_at) == today_str,
    ).count()

    # ── Materials ──────────────────────────────────────────────────────────
    materials_today = db.query(Material).filter(
        Material.user_id == uid,
        func.date(Material.created_at) == today_str,
    ).count()

    # ── Mentor messages ────────────────────────────────────────────────────
    mentor_today = db.query(MentorConversation).filter(
        MentorConversation.user_id == uid,
        MentorConversation.role == "user",
        func.date(MentorConversation.created_at) == today_str,
    ).count()

    return {
        "date":                   today_str,
        "sessions_completed":     sessions_count,
        "total_study_minutes":    total_minutes,
        "max_session_minutes":    max_session,
        "subject_minutes":        subject_minutes,
        "quizzes_completed":      quiz_count,
        "quiz_correct_answers":   quiz_correct,
        "quiz_total_questions":   quiz_total_q,
        "quiz_max_pct":           quiz_max_pct,
        "checkin_today":          checkin is not None,
        "notes_created_today":    notes_today,
        "materials_uploaded_today": materials_today,
        "mentor_messages_today":  mentor_today,
    }
