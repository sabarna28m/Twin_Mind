import json
import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from app.api.routes.auth import get_current_user
from app.core.database import get_db
from app.models.achievement import UserAchievement
from app.models.learning_data import LearningData
from app.models.quiz import QuizSession
from app.models.streak_shield import StreakShield
from app.models.user import User
from app.models.weekly_challenge import WeeklyChallenge

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/gamification", tags=["gamification"])

# ── Level config ──────────────────────────────────────────────────────────
LEVEL_NAMES = [
    "", "Beginner", "Learner", "Explorer", "Achiever",
    "Scholar", "Expert", "Master", "Champion", "Legend", "Genius",
]
# XP needed to *reach* each level (index = level number, 0 unused)
XP_THRESHOLDS = [0, 0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 3800]


def xp_to_level(xp: int) -> int:
    level = 1
    for lv in range(2, 11):
        if xp >= XP_THRESHOLDS[lv]:
            level = lv
    return level


# Bonus XP awarded when a streak crosses these milestones (cumulative)
STREAK_MILESTONE_XP: dict[int, int] = {7: 50, 30: 150, 100: 500, 365: 1500}


def _compute_streak(entries: list, protected_dates: set | None = None) -> int:
    dates = {e.date for e in entries}
    if protected_dates:
        dates |= protected_dates
    streak = 0
    d = date.today()
    while d in dates:
        streak += 1
        d -= timedelta(days=1)
    return streak


def _load_shield(user_id: int, db: DBSession):
    return db.query(StreakShield).filter(StreakShield.user_id == user_id).first()


def _protected_dates(shield) -> set:
    if not shield:
        return set()
    base: set = set()
    try:
        base = {date.fromisoformat(d) for d in json.loads(shield.shield_protected_dates or "[]")}
    except Exception:
        pass
    # Streak freeze counts as today covered
    from datetime import datetime as _dt
    if shield.streak_freeze_expires and _dt.utcnow() < shield.streak_freeze_expires:
        base.add(date.today())
    return base


def _double_xp_active(shield) -> bool:
    from datetime import datetime as _dt
    return bool(shield and shield.double_xp_expires and _dt.utcnow() < shield.double_xp_expires)


def get_week_start() -> date:
    today = date.today()
    return today - timedelta(days=today.weekday())


def compute_progress(user_id: int, db: DBSession) -> dict:
    entries = db.query(LearningData).filter(LearningData.user_id == user_id).all()
    quizzes = (
        db.query(QuizSession)
        .filter(QuizSession.user_id == user_id, QuizSession.score.isnot(None))
        .all()
    )
    earned_count = (
        db.query(UserAchievement)
        .filter(UserAchievement.user_id == user_id)
        .count()
    )

    shield    = _load_shield(user_id, db)
    protected = _protected_dates(shield)
    streak    = _compute_streak(entries, protected)

    high_scores = sum(1 for q in quizzes if q.total and (q.score / q.total) >= 0.8)

    checkin_xp      = len(entries) * 10
    quiz_xp         = len(quizzes) * 20
    high_score_xp   = high_scores * 30
    streak_xp       = streak * 5
    achievement_xp  = earned_count * 50
    milestone_bonus = sum(v for k, v in STREAK_MILESTONE_XP.items() if streak >= k)

    raw_xp   = checkin_xp + quiz_xp + high_score_xp + streak_xp + achievement_xp + milestone_bonus
    xp       = raw_xp * 2 if _double_xp_active(shield) else raw_xp
    level = xp_to_level(xp)

    level_start  = XP_THRESHOLDS[level]
    level_end    = XP_THRESHOLDS[level + 1] if level < 10 else XP_THRESHOLDS[10] + 500
    xp_in_level  = xp - level_start
    xp_for_level = level_end - level_start
    progress_pct = 100 if level == 10 else min(100, round(xp_in_level / xp_for_level * 100))

    xp_spent     = shield.xp_spent if shield else 0
    available_xp = max(0, xp - xp_spent)

    return {
        "xp":           xp,
        "available_xp": available_xp,
        "xp_spent":     xp_spent,
        "level":        level,
        "level_name":   LEVEL_NAMES[level],
        "xp_in_level":  xp_in_level,
        "xp_for_level": xp_for_level,
        "xp_to_next":   max(0, xp_for_level - xp_in_level),
        "progress_pct": progress_pct,
        "streak_days":  streak,
        "shield_count":          shield.shield_count if shield else 0,
        "premium_shield_count":  shield.premium_shield_count if shield else 0,
        "double_xp_active":      _double_xp_active(shield),
        "double_xp_expires":     shield.double_xp_expires.isoformat() if (shield and shield.double_xp_expires) else None,
        "breakdown": {
            "checkins":        checkin_xp,
            "quizzes":         quiz_xp,
            "high_scores":     high_score_xp,
            "streak":          streak_xp,
            "achievements":    achievement_xp,
            "streak_milestones": milestone_bonus,
        },
    }


# ── Routes ────────────────────────────────────────────────────────────────
@router.get("/progress")
def get_progress(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    return compute_progress(current_user.id, db)


class ChallengePayload(BaseModel):
    target_study_hours: Optional[float] = None
    target_quiz_count: Optional[int] = None
    target_checkin_days: Optional[int] = None


@router.get("/weekly-challenge")
def get_weekly_challenge(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    week_start = get_week_start()

    challenge = (
        db.query(WeeklyChallenge)
        .filter(
            WeeklyChallenge.user_id == current_user.id,
            WeeklyChallenge.week_start == week_start,
        )
        .first()
    )

    # Compute this-week progress regardless
    entries = (
        db.query(LearningData)
        .filter(LearningData.user_id == current_user.id, LearningData.date >= week_start)
        .all()
    )
    quiz_count = (
        db.query(QuizSession)
        .filter(
            QuizSession.user_id == current_user.id,
            QuizSession.created_at >= week_start,
            QuizSession.score.isnot(None),
        )
        .count()
    )
    study_hours   = round(sum(e.study_hours for e in entries), 1)
    checkin_days  = len({e.date for e in entries})

    progress = {
        "study_hours":  study_hours,
        "quiz_count":   quiz_count,
        "checkin_days": checkin_days,
    }

    if not challenge:
        return {
            "has_challenge": False,
            "week_start": week_start.isoformat(),
            "targets": None,
            "progress": progress,
            "completion_pct": 0,
        }

    targets = {
        "study_hours":  challenge.target_study_hours,
        "quiz_count":   challenge.target_quiz_count,
        "checkin_days": challenge.target_checkin_days,
    }

    metrics: list[float] = []
    if challenge.target_study_hours:
        metrics.append(min(1.0, study_hours / challenge.target_study_hours))
    if challenge.target_quiz_count:
        metrics.append(min(1.0, quiz_count / challenge.target_quiz_count))
    if challenge.target_checkin_days:
        metrics.append(min(1.0, checkin_days / challenge.target_checkin_days))
    completion_pct = round(sum(metrics) / len(metrics) * 100) if metrics else 0

    return {
        "has_challenge": True,
        "week_start": week_start.isoformat(),
        "targets": targets,
        "progress": progress,
        "completion_pct": completion_pct,
    }


@router.post("/weekly-challenge")
def set_weekly_challenge(
    payload: ChallengePayload,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    week_start = get_week_start()
    challenge = (
        db.query(WeeklyChallenge)
        .filter(
            WeeklyChallenge.user_id == current_user.id,
            WeeklyChallenge.week_start == week_start,
        )
        .first()
    )
    if challenge:
        challenge.target_study_hours  = payload.target_study_hours
        challenge.target_quiz_count   = payload.target_quiz_count
        challenge.target_checkin_days = payload.target_checkin_days
    else:
        challenge = WeeklyChallenge(
            user_id=current_user.id,
            week_start=week_start,
            target_study_hours=payload.target_study_hours,
            target_quiz_count=payload.target_quiz_count,
            target_checkin_days=payload.target_checkin_days,
        )
        db.add(challenge)
    db.commit()
    return {"ok": True}
