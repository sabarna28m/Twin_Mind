from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.models.user import User
from app.models.learning_data import LearningData
from app.models.achievement import UserAchievement
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/achievements", tags=["achievements"])

# ── Badge catalogue ────────────────────────────────────────────────────────────
BADGES: list[dict[str, Any]] = [
    {
        "id": "first_step",
        "name": "First Step",
        "description": "Log your very first check-in",
        "icon": "🌱",
        "color": "#10b981",
    },
    {
        "id": "consistent",
        "name": "Consistent",
        "description": "Check in 5 days in a row",
        "icon": "🔥",
        "color": "#f59e0b",
    },
    {
        "id": "week_warrior",
        "name": "Week Warrior",
        "description": "Maintain a 7-day check-in streak",
        "icon": "⚔️",
        "color": "#6366f1",
    },
    {
        "id": "month_master",
        "name": "Month Master",
        "description": "Maintain a 30-day check-in streak",
        "icon": "🏆",
        "color": "#f59e0b",
    },
    {
        "id": "perfect_score",
        "name": "Perfect Score",
        "description": "Achieve a quiz or exam score above 90%",
        "icon": "💯",
        "color": "#ec4899",
    },
    {
        "id": "early_bird",
        "name": "Early Bird",
        "description": "Submit a check-in before 8 AM",
        "icon": "🌅",
        "color": "#f59e0b",
    },
    {
        "id": "night_owl",
        "name": "Night Owl",
        "description": "Submit a check-in after 10 PM",
        "icon": "🦉",
        "color": "#6366f1",
    },
    {
        "id": "overachiever",
        "name": "Overachiever",
        "description": "Study for 8+ hours in a single day",
        "icon": "⚡",
        "color": "#8b5cf6",
    },
    {
        "id": "wellness_hero",
        "name": "Wellness Hero",
        "description": "Sleep 8+ hours for 7 consecutive days",
        "icon": "💪",
        "color": "#10b981",
    },
]

BADGE_IDS = {b["id"] for b in BADGES}


# ── Evaluation helpers ─────────────────────────────────────────────────────────

def _max_streak(entries) -> int:
    """Longest consecutive-day streak ever in the entry history."""
    dates = sorted(set(e.date for e in entries))
    if not dates:
        return 0
    max_s = cur_s = 1
    for i in range(1, len(dates)):
        if (dates[i] - dates[i - 1]).days == 1:
            cur_s += 1
            if cur_s > max_s:
                max_s = cur_s
        else:
            cur_s = 1
    return max_s


def _max_sleep_streak(entries) -> int:
    """Longest consecutive-day run where sleep_duration >= 8."""
    dates = sorted(e.date for e in entries if e.sleep_duration >= 8)
    if not dates:
        return 0
    max_s = cur_s = 1
    for i in range(1, len(dates)):
        if (dates[i] - dates[i - 1]).days == 1:
            cur_s += 1
            if cur_s > max_s:
                max_s = cur_s
        else:
            cur_s = 1
    return max_s


def evaluate_badges(entries) -> set:
    """Return the set of badge IDs the user has EARNED based on their data."""
    earned: set[str] = set()
    if not entries:
        return earned

    earned.add("first_step")

    streak = _max_streak(entries)
    if streak >= 5:
        earned.add("consistent")
    if streak >= 7:
        earned.add("week_warrior")
    if streak >= 30:
        earned.add("month_master")

    if any(
        (e.quiz_scores  is not None and e.quiz_scores  > 90) or
        (e.exam_scores  is not None and e.exam_scores  > 90)
        for e in entries
    ):
        earned.add("perfect_score")

    if any(e.created_at and e.created_at.hour < 8 for e in entries):
        earned.add("early_bird")

    if any(e.created_at and e.created_at.hour >= 22 for e in entries):
        earned.add("night_owl")

    if any(e.study_hours >= 8 for e in entries):
        earned.add("overachiever")

    if _max_sleep_streak(entries) >= 7:
        earned.add("wellness_hero")

    return earned


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("")
def get_achievements(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Return all badges with earned status and timestamp."""
    rows = db.query(UserAchievement).filter(
        UserAchievement.user_id == current_user.id
    ).all()
    earned_map = {r.badge_id: r.earned_at for r in rows}

    return [
        {
            **badge,
            "earned": badge["id"] in earned_map,
            "earned_at": earned_map.get(badge["id"]),
        }
        for badge in BADGES
    ]


@router.post("/check")
def check_and_award(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Evaluate badge conditions and award any newly earned badges. Returns new ones."""
    entries = (
        db.query(LearningData)
        .filter(LearningData.user_id == current_user.id)
        .all()
    )

    should_earn = evaluate_badges(entries)

    already_earned = {
        r.badge_id
        for r in db.query(UserAchievement)
        .filter(UserAchievement.user_id == current_user.id)
        .all()
    }

    new_ids = should_earn - already_earned
    for badge_id in new_ids:
        try:
            db.add(UserAchievement(user_id=current_user.id, badge_id=badge_id))
            db.commit()
        except IntegrityError:
            db.rollback()

    new_badges = [b for b in BADGES if b["id"] in new_ids]
    return {"new_badges": new_badges}
