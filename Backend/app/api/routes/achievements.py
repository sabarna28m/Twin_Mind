from collections import Counter
from dataclasses import dataclass, field
from datetime import date as DateType, timedelta
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.models.user import User
from app.models.learning_data import LearningData
from app.models.achievement import UserAchievement
from app.models.session import Session as StudySession
from app.models.quiz import QuizSession
from app.models.material import Material
from app.models.smart_note import SmartNote
from app.models.battle import Battle
from app.models.mentor_conversation import MentorConversation
from app.models.comm_twin import CommTwin
from app.models.student_profile import StudentProfile
from app.api.routes.auth import get_current_user
from app.models.streak_shield import StreakShield
from app.services.notifications import create_badge_notification, notify_shield_earned

router = APIRouter(prefix="/achievements", tags=["achievements"])

# Shields granted when these streak badges are newly earned
_STREAK_BADGE_SHIELDS: dict[str, int] = {
    "week_warrior": 1,
    "month_master": 2,
    "unstoppable":  3,
}


def _grant_shields_for_badges(new_ids: set, user_id: int, db: DBSession) -> None:
    grants = sum(_STREAK_BADGE_SHIELDS.get(bid, 0) for bid in new_ids)
    if not grants:
        return
    shield = db.query(StreakShield).filter(StreakShield.user_id == user_id).first()
    if not shield:
        shield = StreakShield(user_id=user_id)
        db.add(shield)
    prev = shield.shield_count
    shield.shield_count = min(5, prev + grants)
    db.commit()
    if shield.shield_count > prev:
        notify_shield_earned(db, user_id, shield.shield_count)

# ── XP / Level helpers (mirrors gamification.py without importing it) ──────────
_XP_THRESHOLDS = [0, 0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 3800]


def _xp_to_level(xp: int) -> int:
    level = 1
    for lv in range(2, 11):
        if xp >= _XP_THRESHOLDS[lv]:
            level = lv
    return level


# ── Full badge catalogue — 36 achievements ─────────────────────────────────────
BADGES: list[dict[str, Any]] = [

    # ── ONBOARDING ──────────────────────────────────────────────────────────
    {
        "id": "first_step", "name": "First Step", "icon": "🌱",
        "description": "Log your very first daily check-in.",
        "color": "#10b981", "category": "onboarding",
        "xp_reward": 25, "rarity": "common", "progress_target": 1, "hidden": False,
    },
    {
        "id": "session_starter", "name": "Session Starter", "icon": "⏱️",
        "description": "Complete your first study session.",
        "color": "#00D4FF", "category": "onboarding",
        "xp_reward": 25, "rarity": "common", "progress_target": 1, "hidden": False,
    },
    {
        "id": "knowledge_explorer", "name": "Knowledge Explorer", "icon": "🧭",
        "description": "Upload your first study material.",
        "color": "#34d399", "category": "onboarding",
        "xp_reward": 25, "rarity": "common", "progress_target": 1, "hidden": False,
    },
    {
        "id": "quiz_rookie", "name": "Quiz Rookie", "icon": "📝",
        "description": "Complete your first practice quiz.",
        "color": "#a78bfa", "category": "onboarding",
        "xp_reward": 25, "rarity": "common", "progress_target": 1, "hidden": False,
    },

    # ── STUDY SESSIONS ──────────────────────────────────────────────────────
    {
        "id": "focus_builder", "name": "Focus Builder", "icon": "🔥",
        "description": "Complete 5 study sessions.",
        "color": "#f97316", "category": "sessions",
        "xp_reward": 50, "rarity": "common", "progress_target": 5, "hidden": False,
    },
    {
        "id": "deep_worker", "name": "Deep Worker", "icon": "🧠",
        "description": "Complete a single study session lasting 60 minutes or more.",
        "color": "#00D4FF", "category": "sessions",
        "xp_reward": 75, "rarity": "rare", "progress_target": 1, "hidden": False,
    },
    {
        "id": "overachiever", "name": "Overachiever", "icon": "⚡",
        "description": "Log 8+ study hours in a single day via check-in.",
        "color": "#8b5cf6", "category": "sessions",
        "xp_reward": 100, "rarity": "rare", "progress_target": 1, "hidden": False,
    },
    {
        "id": "marathon_learner", "name": "Marathon Learner", "icon": "🏃",
        "description": "Accumulate 10 total study hours across all sessions.",
        "color": "#22d3ee", "category": "sessions",
        "xp_reward": 100, "rarity": "rare", "progress_target": 10, "hidden": False,
    },
    {
        "id": "time_master", "name": "Time Master", "icon": "⌛",
        "description": "Accumulate 50 total study hours across all sessions.",
        "color": "#6366f1", "category": "sessions",
        "xp_reward": 250, "rarity": "epic", "progress_target": 50, "hidden": False,
    },

    # ── QUIZ PERFORMANCE ────────────────────────────────────────────────────
    {
        "id": "perfect_score", "name": "Perfect Score", "icon": "💯",
        "description": "Achieve a quiz or exam score above 90%.",
        "color": "#ec4899", "category": "quiz",
        "xp_reward": 75, "rarity": "rare", "progress_target": 1, "hidden": False,
    },
    {
        "id": "focused_mind", "name": "Focused Mind", "icon": "👁️",
        "description": "Score above 80% in any practice quiz.",
        "color": "#7C3AED", "category": "quiz",
        "xp_reward": 50, "rarity": "common", "progress_target": 1, "hidden": False,
    },
    {
        "id": "quiz_champion", "name": "Quiz Champion", "icon": "🏆",
        "description": "Complete 10 practice quizzes.",
        "color": "#f59e0b", "category": "quiz",
        "xp_reward": 100, "rarity": "rare", "progress_target": 10, "hidden": False,
    },
    {
        "id": "accuracy_expert", "name": "Accuracy Expert", "icon": "🎯",
        "description": "Score 85% or higher in at least 5 different quizzes.",
        "color": "#10b981", "category": "quiz",
        "xp_reward": 150, "rarity": "epic", "progress_target": 5, "hidden": False,
    },

    # ── CONSISTENCY & STREAKS ───────────────────────────────────────────────
    {
        "id": "consistent", "name": "Consistent", "icon": "📅",
        "description": "Check in for 5 consecutive days.",
        "color": "#f59e0b", "category": "streaks",
        "xp_reward": 50, "rarity": "common", "progress_target": 5, "hidden": False,
    },
    {
        "id": "week_warrior", "name": "Week Warrior", "icon": "⚔️",
        "description": "Maintain a 7-day check-in streak.",
        "color": "#6366f1", "category": "streaks",
        "xp_reward": 100, "rarity": "rare", "progress_target": 7, "hidden": False,
    },
    {
        "id": "month_master", "name": "Month Master", "icon": "👑",
        "description": "Maintain a 30-day check-in streak.",
        "color": "#f59e0b", "category": "streaks",
        "xp_reward": 300, "rarity": "epic", "progress_target": 30, "hidden": False,
    },
    {
        "id": "unstoppable", "name": "Unstoppable", "icon": "🚀",
        "description": "Maintain a 100-day check-in streak.",
        "color": "#eab308", "category": "streaks",
        "xp_reward": 1000, "rarity": "legendary", "progress_target": 100, "hidden": False,
    },

    # ── MATERIALS & NOTES ───────────────────────────────────────────────────
    {
        "id": "collector", "name": "Collector", "icon": "📚",
        "description": "Upload 10 study materials to your library.",
        "color": "#34d399", "category": "materials",
        "xp_reward": 100, "rarity": "rare", "progress_target": 10, "hidden": False,
    },
    {
        "id": "smart_note_creator", "name": "Smart Note Creator", "icon": "✍️",
        "description": "Create 20 smart notes.",
        "color": "#22d3ee", "category": "materials",
        "xp_reward": 100, "rarity": "rare", "progress_target": 20, "hidden": False,
    },
    {
        "id": "revision_pro", "name": "Revision Pro", "icon": "🔄",
        "description": "Create smart notes on 7 different days.",
        "color": "#a78bfa", "category": "materials",
        "xp_reward": 100, "rarity": "rare", "progress_target": 7, "hidden": False,
    },

    # ── AI FEATURES ─────────────────────────────────────────────────────────
    {
        "id": "mentor_seeker", "name": "Mentor Seeker", "icon": "🤖",
        "description": "Send 10 messages to the AI Mentor.",
        "color": "#6366f1", "category": "ai",
        "xp_reward": 75, "rarity": "rare", "progress_target": 10, "hidden": False,
    },
    {
        "id": "twin_builder", "name": "Twin Builder", "icon": "🪞",
        "description": "Complete your student profile setup.",
        "color": "#8b5cf6", "category": "ai",
        "xp_reward": 50, "rarity": "common", "progress_target": 1, "hidden": False,
    },
    {
        "id": "predictor", "name": "Predictor", "icon": "📈",
        "description": "Log 3 check-ins to unlock AI performance predictions.",
        "color": "#3b82f6", "category": "ai",
        "xp_reward": 40, "rarity": "common", "progress_target": 3, "hidden": False,
    },
    {
        "id": "community_twin", "name": "Community Twin", "icon": "🤝",
        "description": "Start your first Comm Twin session.",
        "color": "#f43f5e", "category": "ai",
        "xp_reward": 50, "rarity": "common", "progress_target": 1, "hidden": False,
    },

    # ── PROGRESS & ANALYTICS ────────────────────────────────────────────────
    {
        "id": "wellness_hero", "name": "Wellness Hero", "icon": "💪",
        "description": "Sleep 8+ hours for 7 consecutive days (via check-in).",
        "color": "#10b981", "category": "progress",
        "xp_reward": 100, "rarity": "rare", "progress_target": 7, "hidden": False,
    },
    {
        "id": "xp_hunter", "name": "XP Hunter", "icon": "⭐",
        "description": "Earn 1,000 total XP on the platform.",
        "color": "#f59e0b", "category": "progress",
        "xp_reward": 200, "rarity": "epic", "progress_target": 1000, "hidden": False,
    },
    {
        "id": "level_up", "name": "Level Up", "icon": "🏅",
        "description": "Reach Level 5.",
        "color": "#6366f1", "category": "progress",
        "xp_reward": 200, "rarity": "epic", "progress_target": 5, "hidden": False,
    },

    # ── SOCIAL & COMMUNITY ──────────────────────────────────────────────────
    {
        "id": "challenger", "name": "Challenger", "icon": "⚡",
        "description": "Complete your first battle.",
        "color": "#f43f5e", "category": "social",
        "xp_reward": 50, "rarity": "common", "progress_target": 1, "hidden": False,
    },
    {
        "id": "competitor", "name": "Competitor", "icon": "🥇",
        "description": "Win 3 battles.",
        "color": "#eab308", "category": "social",
        "xp_reward": 150, "rarity": "rare", "progress_target": 3, "hidden": False,
    },

    # ── MASTERY ─────────────────────────────────────────────────────────────
    {
        "id": "subject_master", "name": "Subject Master", "icon": "🎓",
        "description": "Complete 25 study sessions in a single subject.",
        "color": "#eab308", "category": "mastery",
        "xp_reward": 500, "rarity": "legendary", "progress_target": 25, "hidden": False,
    },
    {
        "id": "learning_machine", "name": "Learning Machine", "icon": "⚙️",
        "description": "Unlock any 15 achievements.",
        "color": "#a855f7", "category": "mastery",
        "xp_reward": 300, "rarity": "epic", "progress_target": 15, "hidden": False,
    },
    {
        "id": "twinmind_legend", "name": "TwinMind Legend", "icon": "🌌",
        "description": "Unlock all achievements. The ultimate TwinMind challenge.",
        "color": "#eab308", "category": "mastery",
        "xp_reward": 2000, "rarity": "legendary", "progress_target": 35, "hidden": False,
    },

    # ── HIDDEN / SECRET ─────────────────────────────────────────────────────
    {
        "id": "early_bird", "name": "Early Bird", "icon": "🌅",
        "description": "Submit a check-in before 8 AM.",
        "color": "#f59e0b", "category": "hidden",
        "xp_reward": 75, "rarity": "rare", "progress_target": 1, "hidden": True,
    },
    {
        "id": "night_owl", "name": "Night Owl", "icon": "🌙",
        "description": "Complete a study session after 11 PM.",
        "color": "#6366f1", "category": "hidden",
        "xp_reward": 75, "rarity": "rare", "progress_target": 1, "hidden": True,
    },
    {
        "id": "comeback_kid", "name": "Comeback Kid", "icon": "🔄",
        "description": "Resume studying after a 7-day break.",
        "color": "#10b981", "category": "hidden",
        "xp_reward": 75, "rarity": "rare", "progress_target": 1, "hidden": True,
    },
    {
        "id": "weekend_warrior", "name": "Weekend Warrior", "icon": "🗓️",
        "description": "Complete study activity on both Saturday and Sunday.",
        "color": "#f43f5e", "category": "hidden",
        "xp_reward": 75, "rarity": "rare", "progress_target": 1, "hidden": True,
    },
]

BADGE_IDS = {b["id"] for b in BADGES}
TOTAL_NON_LEGEND = len(BADGES) - 1  # exclude twinmind_legend itself


# ── Streak helpers ─────────────────────────────────────────────────────────────

def _max_streak(entries) -> int:
    dates = sorted(set(e.date for e in entries))
    if not dates:
        return 0
    max_s = cur_s = 1
    for i in range(1, len(dates)):
        if (dates[i] - dates[i - 1]).days == 1:
            cur_s += 1
            max_s = max(max_s, cur_s)
        else:
            cur_s = 1
    return max_s


def _max_sleep_streak(entries) -> int:
    dates = sorted(e.date for e in entries if (e.sleep_duration or 0) >= 8)
    if not dates:
        return 0
    max_s = cur_s = 1
    for i in range(1, len(dates)):
        if (dates[i] - dates[i - 1]).days == 1:
            cur_s += 1
            max_s = max(max_s, cur_s)
        else:
            cur_s = 1
    return max_s


def _note_active_days(smart_notes) -> int:
    days = set()
    for n in smart_notes:
        if n.created_at:
            days.add(n.created_at.date())
    return len(days)


def _has_comeback(entries) -> bool:
    dates = sorted(e.date for e in entries)
    for i in range(1, len(dates)):
        if (dates[i] - dates[i - 1]).days >= 7:
            return True
    return False


def _has_weekend_activity(entries, sessions) -> bool:
    has_sat = (
        any(e.date.weekday() == 5 for e in entries) or
        any(s.created_at and s.created_at.weekday() == 5 for s in sessions)
    )
    has_sun = (
        any(e.date.weekday() == 6 for e in entries) or
        any(s.created_at and s.created_at.weekday() == 6 for s in sessions)
    )
    return has_sat and has_sun


# ── Evaluation ─────────────────────────────────────────────────────────────────

def evaluate_badges(
    user_id: int,
    entries,
    all_sessions,
    quizzes,
    materials,
    smart_notes,
    battles,
    mentor_msgs,
    comm_twin,
    student_profile,
) -> set:
    earned: set[str] = set()

    completed_sessions = [s for s in all_sessions if s.status == "completed"]
    total_session_hours = sum((s.duration_minutes or 0) for s in all_sessions) / 60.0

    streak = _max_streak(entries)
    sleep_streak = _max_sleep_streak(entries)
    note_days = _note_active_days(smart_notes)

    mentor_user_msgs = [m for m in mentor_msgs if m.role == "user"]

    quiz_high_scores = [q for q in quizzes if q.total and (q.score / q.total) >= 0.85]
    quiz_80_plus = [q for q in quizzes if q.total and (q.score / q.total) >= 0.80]

    subject_counts: Counter = Counter(
        s.subject for s in completed_sessions if s.subject
    )
    max_subject_sessions = max(subject_counts.values()) if subject_counts else 0

    completed_battles = [b for b in battles if b.status == "completed"]
    won_battles = [b for b in battles if b.winner_id == user_id]

    # Approximate XP (without achievement bonus to avoid circularity)
    checkin_xp = len(entries) * 10
    quiz_xp = len(quizzes) * 20
    high_score_xp = sum(30 for q in quizzes if q.total and (q.score / q.total) >= 0.8)
    streak_xp = streak * 5
    base_xp = checkin_xp + quiz_xp + high_score_xp + streak_xp
    level = _xp_to_level(base_xp)

    # ── Onboarding ──────────────────────────────────────────────────────────
    if entries:
        earned.add("first_step")
    if completed_sessions:
        earned.add("session_starter")
    if materials:
        earned.add("knowledge_explorer")
    if quizzes:
        earned.add("quiz_rookie")

    # ── Study Sessions ──────────────────────────────────────────────────────
    if len(completed_sessions) >= 5:
        earned.add("focus_builder")
    if any((s.duration_minutes or 0) >= 60 for s in all_sessions):
        earned.add("deep_worker")
    if any((e.study_hours or 0) >= 8 for e in entries):
        earned.add("overachiever")
    if total_session_hours >= 10:
        earned.add("marathon_learner")
    if total_session_hours >= 50:
        earned.add("time_master")

    # ── Quiz ────────────────────────────────────────────────────────────────
    if any(
        (q.quiz_scores is not None and q.quiz_scores > 90) or
        (q.exam_scores is not None and q.exam_scores > 90)
        for q in entries
    ) or any(q.total and (q.score / q.total) > 0.90 for q in quizzes):
        earned.add("perfect_score")
    if quiz_80_plus:
        earned.add("focused_mind")
    if len(quizzes) >= 10:
        earned.add("quiz_champion")
    if len(quiz_high_scores) >= 5:
        earned.add("accuracy_expert")

    # ── Streaks ─────────────────────────────────────────────────────────────
    if streak >= 5:
        earned.add("consistent")
    if streak >= 7:
        earned.add("week_warrior")
    if streak >= 30:
        earned.add("month_master")
    if streak >= 100:
        earned.add("unstoppable")

    # ── Materials & Notes ───────────────────────────────────────────────────
    if len(materials) >= 10:
        earned.add("collector")
    if len(smart_notes) >= 20:
        earned.add("smart_note_creator")
    if note_days >= 7:
        earned.add("revision_pro")

    # ── AI Features ─────────────────────────────────────────────────────────
    if len(mentor_user_msgs) >= 10:
        earned.add("mentor_seeker")
    if student_profile:
        earned.add("twin_builder")
    if len(entries) >= 3:
        earned.add("predictor")
    if comm_twin and (comm_twin.sessions_count or 0) > 0:
        earned.add("community_twin")

    # ── Progress ────────────────────────────────────────────────────────────
    if sleep_streak >= 7:
        earned.add("wellness_hero")
    if base_xp >= 1000:
        earned.add("xp_hunter")
    if level >= 5:
        earned.add("level_up")

    # ── Social ──────────────────────────────────────────────────────────────
    if completed_battles:
        earned.add("challenger")
    if len(won_battles) >= 3:
        earned.add("competitor")

    # ── Mastery ─────────────────────────────────────────────────────────────
    if max_subject_sessions >= 25:
        earned.add("subject_master")

    # Recursive: learning_machine + twinmind_legend
    base_count = len(earned)
    if base_count >= 15:
        earned.add("learning_machine")
    if len(earned) >= TOTAL_NON_LEGEND:
        earned.add("twinmind_legend")

    # ── Hidden / Secret ─────────────────────────────────────────────────────
    if any(e.created_at and e.created_at.hour < 8 for e in entries):
        earned.add("early_bird")
    if any(
        s.created_at and s.created_at.hour >= 23 for s in all_sessions
    ) or any(e.created_at and e.created_at.hour >= 22 for e in entries):
        earned.add("night_owl")
    if _has_comeback(entries):
        earned.add("comeback_kid")
    if _has_weekend_activity(entries, all_sessions):
        earned.add("weekend_warrior")

    return earned


def compute_progress_values(
    user_id: int,
    entries,
    all_sessions,
    quizzes,
    materials,
    smart_notes,
    battles,
    mentor_msgs,
    comm_twin,
    student_profile,
    earned: set,
) -> dict[str, float]:
    """Return current progress value for each badge (used for progress bars)."""

    completed_sessions = [s for s in all_sessions if s.status == "completed"]
    total_session_hours = sum((s.duration_minutes or 0) for s in all_sessions) / 60.0
    streak = _max_streak(entries)
    sleep_streak = _max_sleep_streak(entries)
    note_days = _note_active_days(smart_notes)
    mentor_user_msgs = [m for m in mentor_msgs if m.role == "user"]
    quiz_80_plus = sum(1 for q in quizzes if q.total and (q.score / q.total) >= 0.80)
    quiz_high = sum(1 for q in quizzes if q.total and (q.score / q.total) >= 0.85)
    quiz_90_plus = sum(
        1 for q in quizzes if q.total and (q.score / q.total) > 0.90
    ) + sum(
        1 for e in entries if (e.quiz_scores or 0) > 90 or (e.exam_scores or 0) > 90
    )

    subject_counts: Counter = Counter(
        s.subject for s in completed_sessions if s.subject
    )
    max_subject = max(subject_counts.values()) if subject_counts else 0
    won_battles = sum(1 for b in battles if b.winner_id == user_id)
    completed_battles = sum(1 for b in battles if b.status == "completed")

    checkin_xp = len(entries) * 10
    quiz_xp = len(quizzes) * 20
    high_score_xp = sum(30 for q in quizzes if q.total and (q.score / q.total) >= 0.8)
    streak_xp = streak * 5
    base_xp = checkin_xp + quiz_xp + high_score_xp + streak_xp
    level = _xp_to_level(base_xp)

    # Count non-recursive badges for mastery progress
    non_mastery = earned - {"learning_machine", "twinmind_legend"}
    earned_for_lm = len(non_mastery)
    earned_for_legend = len(earned - {"twinmind_legend"})

    return {
        "first_step":           min(1, len(entries)),
        "session_starter":      min(1, len(completed_sessions)),
        "knowledge_explorer":   min(1, len(materials)),
        "quiz_rookie":          min(1, len(quizzes)),
        "focus_builder":        min(5, len(completed_sessions)),
        "deep_worker":          min(1, sum(1 for s in all_sessions if (s.duration_minutes or 0) >= 60)),
        "overachiever":         min(1, sum(1 for e in entries if (e.study_hours or 0) >= 8)),
        "marathon_learner":     round(min(10, total_session_hours), 1),
        "time_master":          round(min(50, total_session_hours), 1),
        "perfect_score":        min(1, quiz_90_plus),
        "focused_mind":         min(1, quiz_80_plus),
        "quiz_champion":        min(10, len(quizzes)),
        "accuracy_expert":      min(5, quiz_high),
        "consistent":           min(5, streak),
        "week_warrior":         min(7, streak),
        "month_master":         min(30, streak),
        "unstoppable":          min(100, streak),
        "collector":            min(10, len(materials)),
        "smart_note_creator":   min(20, len(smart_notes)),
        "revision_pro":         min(7, note_days),
        "mentor_seeker":        min(10, len(mentor_user_msgs)),
        "twin_builder":         1 if student_profile else 0,
        "predictor":            min(3, len(entries)),
        "community_twin":       1 if (comm_twin and (comm_twin.sessions_count or 0) > 0) else 0,
        "wellness_hero":        min(7, sleep_streak),
        "xp_hunter":            min(1000, base_xp),
        "level_up":             min(5, level),
        "challenger":           min(1, completed_battles),
        "competitor":           min(3, won_battles),
        "subject_master":       min(25, max_subject),
        "learning_machine":     min(15, earned_for_lm),
        "twinmind_legend":      min(TOTAL_NON_LEGEND, earned_for_legend),
        # Hidden badges are binary
        "early_bird":           1 if "early_bird" in earned else 0,
        "night_owl":            1 if "night_owl" in earned else 0,
        "comeback_kid":         1 if "comeback_kid" in earned else 0,
        "weekend_warrior":      1 if "weekend_warrior" in earned else 0,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

def _fetch_context(user_id: int, db: DBSession) -> tuple:
    entries        = db.query(LearningData).filter(LearningData.user_id == user_id).all()
    all_sessions   = db.query(StudySession).filter(StudySession.user_id == user_id).all()
    quizzes        = db.query(QuizSession).filter(QuizSession.user_id == user_id, QuizSession.score.isnot(None)).all()
    materials      = db.query(Material).filter(Material.user_id == user_id).all()
    smart_notes    = db.query(SmartNote).filter(SmartNote.user_id == user_id).all()
    battles        = db.query(Battle).filter(
        (Battle.challenger_id == user_id) | (Battle.winner_id == user_id)
    ).all()
    mentor_msgs    = db.query(MentorConversation).filter(MentorConversation.user_id == user_id).all()
    comm_twin      = db.query(CommTwin).filter(CommTwin.user_id == user_id).first()
    student_profile= db.query(StudentProfile).filter(StudentProfile.user_id == user_id).first()
    return entries, all_sessions, quizzes, materials, smart_notes, battles, mentor_msgs, comm_twin, student_profile


@router.get("")
def get_achievements(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Return all badges with earned status, progress, and metadata."""
    uid = current_user.id
    ctx = _fetch_context(uid, db)
    entries, all_sessions, quizzes, materials, smart_notes, battles, mentor_msgs, comm_twin, student_profile = ctx

    earned_set = evaluate_badges(uid, *ctx)
    progress   = compute_progress_values(uid, *ctx, earned=earned_set)

    rows = db.query(UserAchievement).filter(UserAchievement.user_id == uid).all()
    earned_map = {r.badge_id: r.earned_at for r in rows}

    return [
        {
            **badge,
            "earned":           badge["id"] in earned_map,
            "earned_at":        earned_map.get(badge["id"]),
            "progress_current": progress.get(badge["id"], 0),
        }
        for badge in BADGES
    ]


@router.post("/check")
def check_and_award(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Evaluate badge conditions and award any newly earned badges."""
    uid = current_user.id
    ctx = _fetch_context(uid, db)

    should_earn = evaluate_badges(uid, *ctx)

    already_earned = {
        r.badge_id
        for r in db.query(UserAchievement).filter(UserAchievement.user_id == uid).all()
    }

    new_ids = should_earn - already_earned
    for badge_id in new_ids:
        try:
            db.add(UserAchievement(user_id=uid, badge_id=badge_id))
            db.commit()
        except IntegrityError:
            db.rollback()

    new_badges = [b for b in BADGES if b["id"] in new_ids]
    for badge in new_badges:
        create_badge_notification(db, uid, badge)

    # Grant streak shields for milestone badges
    _grant_shields_for_badges(new_ids, uid, db)

    return {"new_badges": new_badges}
