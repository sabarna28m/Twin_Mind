from datetime import date as DateType
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import exc
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.models.burnout import BurnoutEntry
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.api.schemas.burnout import (
    BurnoutCheckIn, BurnoutResponse, BurnoutTrendPoint, BurnoutAnalysis,
)

router = APIRouter(prefix="/burnout", tags=["burnout"])


# ── Pure calculation helpers ───────────────────────────────────────────

def calculate_burnout(
    study_hours: float, sleep_hours: float, breaks_taken: int,
    study_streak_days: int, mood_rating: int, energy_level: int,
) -> tuple[int, str]:
    score = 0
    if study_hours > 8:
        score += 20
    if sleep_hours < 6:
        score += 25
    if breaks_taken < 2:
        score += 15
    if mood_rating <= 2:
        score += 15
    if energy_level <= 2:
        score += 15
    if study_streak_days > 10:
        score += 10
    score = min(100, score)
    risk = "low" if score < 40 else ("medium" if score < 70 else "high")
    return score, risk


def generate_recommendations(
    study_hours: float, sleep_hours: float, breaks_taken: int,
    mood_rating: int, energy_level: int, study_streak_days: int,
) -> list[str]:
    recs: list[str] = []
    if study_hours > 8 and sleep_hours < 6:
        recs.append(
            "Reduce study time by 1–2 hours and aim for at least 7 hours of sleep tonight. "
            "Sleep debt compounds — recovery now prevents a longer burnout later."
        )
    elif study_hours > 8:
        recs.append(
            f"You've studied {study_hours:.0f} hours today — impressive dedication. "
            "Try capping tomorrow's session at 6–7 hours to allow mental recovery without losing momentum."
        )
    elif sleep_hours < 6:
        recs.append(
            f"Only {sleep_hours:.0f} hours of sleep reduces memory consolidation and focus. "
            "Prioritise 7–8 hours tonight — even one good night makes a measurable difference."
        )
    if breaks_taken < 2:
        recs.append(
            "You're taking fewer than 2 breaks. Apply the Pomodoro technique: "
            "25 minutes of focused study followed by a 5-minute break, with a 15-minute break every 90 minutes."
        )
    if mood_rating <= 2:
        recs.append(
            "Your mood is low today. Shift to lighter revision tasks — re-reading notes or summarising — "
            "rather than tackling new, complex material. Gentle progress still counts."
        )
    if energy_level <= 2:
        recs.append(
            "Low energy detected. A brisk 20-minute walk, light stretching, or 10 minutes of fresh air "
            "can restore mental clarity more effectively than caffeine."
        )
    if study_streak_days > 10:
        recs.append(
            f"You've studied {study_streak_days} consecutive days — an impressive streak. "
            "Schedule one planned rest day this week. Strategic recovery accelerates long-term retention."
        )
    if not recs:
        recs.append(
            "Your metrics look balanced. Keep your current routine — consistent, sustainable effort is the most powerful study strategy."
        )
        recs.append(
            "Stay hydrated throughout the day and take short movement breaks to sustain your energy and focus."
        )
    return recs


def generate_twin_message(
    score: int, risk: str, study_hours: float,
    sleep_hours: float, study_streak_days: int,
) -> str:
    if risk == "high":
        if study_hours > 8 and sleep_hours < 6:
            return (
                f"Your data shows {study_hours:.0f} hours of study paired with only {sleep_hours:.0f} hours of sleep. "
                "I understand the drive to push forward, but your brain consolidates learning during sleep — "
                "every hour of rest is an investment in tomorrow's performance. Rest tonight."
            )
        if study_streak_days > 10:
            return (
                f"An unbroken streak of {study_streak_days} days shows real discipline. "
                "But even elite athletes have rest days written into their training plan. "
                "A strategic pause today will make the next ten days significantly more productive."
            )
        return (
            "I've detected significant burnout indicators in your recent patterns. "
            "I know you want to keep going — but a short, intentional break now "
            "will prevent a much longer forced pause later. Your future self is asking you to rest."
        )
    if risk == "medium":
        if study_streak_days > 7:
            return (
                f"Seven-plus days of consistent effort — your commitment is clear. "
                "Recovery is as much a part of learning as study itself. "
                "Your brain is consolidating everything you've worked on. Consider a lighter session today."
            )
        return (
            "Your burnout indicators are beginning to climb. You're working hard, and that matters. "
            "One restful evening can reset your trajectory significantly — "
            "treat recovery as productive work, because it is."
        )
    return (
        "Your wellbeing metrics look healthy today. "
        "The balance you're maintaining — study, rest, and breaks — is exactly what drives long-term retention. "
        "Keep it up, and remember that consistency beats intensity every time."
    )


def generate_alerts(
    score: int, risk: str, sleep_hours: float, study_hours: float,
) -> list[str]:
    alerts: list[str] = []
    if risk == "high":
        if study_hours > 8:
            alerts.append(
                f"You have studied heavily ({study_hours:.0f}h) with insufficient rest. "
                "Your burnout risk is high — consider taking a recovery break today."
            )
        if sleep_hours < 6:
            alerts.append(
                f"Your sleep ({sleep_hours:.0f}h) is below the recommended 7–8 hours. "
                "Chronic sleep deficit is one of the leading causes of academic burnout."
            )
        if not alerts:
            alerts.append(
                "Your burnout risk is high. Take a break, step outside, and prioritise rest today."
            )
    return alerts


# ── Routes ────────────────────────────────────────────────────────────

@router.post("/check-in", response_model=BurnoutAnalysis, status_code=status.HTTP_201_CREATED)
def create_burnout_checkin(
    payload: BurnoutCheckIn,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    score, risk = calculate_burnout(
        payload.study_hours, payload.sleep_hours, payload.breaks_taken,
        payload.study_streak_days, payload.mood_rating, payload.energy_level,
    )

    # Upsert: replace existing entry for the same date
    existing = db.query(BurnoutEntry).filter(
        BurnoutEntry.user_id == current_user.id,
        BurnoutEntry.date == payload.date,
    ).first()

    if existing:
        for field, value in payload.model_dump().items():
            setattr(existing, field, value)
        existing.burnout_score = score
        existing.risk_level = risk
        db.commit()
        db.refresh(existing)
        entry = existing
    else:
        entry = BurnoutEntry(
            user_id=current_user.id,
            burnout_score=score,
            risk_level=risk,
            **payload.model_dump(),
        )
        db.add(entry)
        try:
            db.commit()
        except exc.IntegrityError:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Entry conflict")
        db.refresh(entry)

    recs = generate_recommendations(
        payload.study_hours, payload.sleep_hours, payload.breaks_taken,
        payload.mood_rating, payload.energy_level, payload.study_streak_days,
    )
    twin_msg = generate_twin_message(score, risk, payload.study_hours, payload.sleep_hours, payload.study_streak_days)
    alerts = generate_alerts(score, risk, payload.sleep_hours, payload.study_hours)

    return BurnoutAnalysis(
        entry=BurnoutResponse.model_validate(entry),
        recommendations=recs,
        twin_message=twin_msg,
        alerts=alerts,
    )


@router.get("/latest", response_model=Optional[BurnoutResponse])
def get_latest(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    return (
        db.query(BurnoutEntry)
        .filter(BurnoutEntry.user_id == current_user.id)
        .order_by(BurnoutEntry.date.desc())
        .first()
    )


@router.get("/history", response_model=List[BurnoutResponse])
def get_history(
    limit: Optional[int] = Query(default=30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    return (
        db.query(BurnoutEntry)
        .filter(BurnoutEntry.user_id == current_user.id)
        .order_by(BurnoutEntry.date.desc())
        .limit(limit)
        .all()
    )


@router.get("/trend", response_model=List[BurnoutTrendPoint])
def get_trend(
    days: int = Query(default=7, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    entries = (
        db.query(BurnoutEntry)
        .filter(BurnoutEntry.user_id == current_user.id)
        .order_by(BurnoutEntry.date.asc())
        .limit(days)
        .all()
    )
    return [
        BurnoutTrendPoint(date=e.date, burnout_score=e.burnout_score, risk_level=e.risk_level)
        for e in entries
    ]
