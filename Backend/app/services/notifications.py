from datetime import date as DateType, timedelta
from typing import Optional
from sqlalchemy.orm import Session as DBSession

from app.models.notification import Notification


def _create(
    db: DBSession,
    user_id: int,
    notification_type: str,
    message: str,
    reference_key: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    emoji: Optional[str] = None,
    title: Optional[str] = None,
    action_url: Optional[str] = None,
) -> Optional[Notification]:
    if reference_key:
        exists = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.reference_key == reference_key,
        ).first()
        if exists:
            return None
    n = Notification(
        user_id=user_id,
        notification_type=notification_type,
        message=message,
        reference_key=reference_key,
        priority=priority,
        category=category,
        emoji=emoji,
        title=title,
        action_url=action_url,
    )
    db.add(n)
    db.commit()
    return n


def create_badge_notification(db: DBSession, user_id: int, badge: dict) -> None:
    _create(
        db, user_id,
        "badge_earned",
        f"You earned the '{badge['name']}' badge! {badge['description']}",
        reference_key=f"badge_{badge['id']}",
    )


def _current_streak(entries) -> int:
    dates = sorted(set(e.date for e in entries), reverse=True)
    if not dates:
        return 0
    today = DateType.today()
    streak = 0
    d = today
    for dt in dates:
        if dt == d:
            streak += 1
            d -= timedelta(days=1)
        elif dt < d:
            break
    return streak


_STREAK_MILESTONES = [3, 7, 14, 30]


def maybe_notify_streak(db: DBSession, user_id: int, entries) -> None:
    streak = _current_streak(entries)
    for milestone in _STREAK_MILESTONES:
        if streak >= milestone:
            _create(
                db, user_id,
                "streak_milestone",
                f"Amazing! You've maintained a {milestone}-day check-in streak. Keep it up!",
                reference_key=f"streak_milestone_{milestone}",
            )


def maybe_notify_low_checkin(db: DBSession, user_id: int, entries) -> None:
    today = DateType.today()
    if not entries:
        _create(
            db, user_id,
            "low_checkin_reminder",
            "You haven't logged a check-in yet. Start tracking your progress today!",
            reference_key=f"low_checkin_{today.isoformat()}",
        )
        return
    last_date = max(e.date for e in entries)
    days_since = (today - last_date).days
    if days_since >= 2:
        _create(
            db, user_id,
            "low_checkin_reminder",
            f"It's been {days_since} day{'s' if days_since != 1 else ''} since your last check-in. Stay consistent!",
            reference_key=f"low_checkin_{today.isoformat()}",
        )


def notify_shield_earned(db: DBSession, user_id: int, shield_count: int) -> None:
    today = DateType.today()
    _create(
        db, user_id,
        "shield_earned",
        f"Congratulations! You earned a Streak Shield. You now have {shield_count} shield{'s' if shield_count != 1 else ''} ready.",
        reference_key=f"shield_earned_{today.isoformat()}_{shield_count}",
        priority="important",
        category="achievement",
        emoji="🛡️",
        title="Streak Shield Earned",
        action_url="/checkin",
    )


def notify_shield_used(db: DBSession, user_id: int, streak: int, shields_remaining: int) -> None:
    today = DateType.today()
    _create(
        db, user_id,
        "shield_used",
        f"Your Streak Shield protected your {streak}-day streak! {shields_remaining} shield{'s' if shields_remaining != 1 else ''} remaining.",
        reference_key=f"shield_used_{today.isoformat()}",
        priority="important",
        category="streak_milestone",
        emoji="🛡️",
        title="Streak Protected",
        action_url="/checkin",
    )


def notify_recovery_available(db: DBSession, user_id: int, missed_date) -> None:
    _create(
        db, user_id,
        "recovery_available",
        f"You missed a check-in on {missed_date.strftime('%B %d')}. Recover your streak within 24 hours for 200 XP.",
        reference_key=f"recovery_{missed_date.isoformat()}",
        priority="critical",
        category="streak_milestone",
        emoji="⚡",
        title="Streak Recovery Available",
        action_url="/checkin",
    )


def notify_no_shields_warning(db: DBSession, user_id: int) -> None:
    today = DateType.today()
    _create(
        db, user_id,
        "no_shields",
        "You have no Streak Shields remaining. Purchase one in the XP Shop to protect future streaks.",
        reference_key=f"no_shields_{today.isoformat()}",
        priority="important",
        category="streak_milestone",
        emoji="⚠️",
        title="No Shields Remaining",
        action_url="/shop",
    )


def maybe_notify_weekly_summary(db: DBSession, user_id: int, entries) -> None:
    today = DateType.today()
    year, week, _ = today.isocalendar()
    ref_key = f"weekly_summary_{year}_{week}"

    week_ago = today - timedelta(days=7)
    recent = [e for e in entries if e.date >= week_ago]
    if not recent:
        return

    avg_study = round(sum(e.study_hours for e in recent) / len(recent), 1)
    avg_stress = round(sum(e.stress_level for e in recent) / len(recent), 1)
    avg_attendance = round(sum(e.attendance_percentage for e in recent) / len(recent))

    _create(
        db, user_id,
        "weekly_summary",
        (
            f"Weekly summary: You averaged {avg_study}h/day of study, "
            f"{avg_attendance}% attendance, and a stress level of {avg_stress}/10 "
            f"over the past {len(recent)} day{'s' if len(recent) != 1 else ''}."
        ),
        reference_key=ref_key,
    )
