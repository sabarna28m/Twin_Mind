import json
import logging
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from app.api.routes.auth import get_current_user
from app.api.routes.gamification import compute_progress
from app.core.database import get_db
from app.models.learning_data import LearningData
from app.models.streak_shield import StreakShield
from app.models.user import User
from app.services.notifications import (
    notify_no_shields_warning,
    notify_recovery_available,
    notify_shield_earned,
    notify_shield_used,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/streak-protection", tags=["streak-protection"])

SHIELD_COST  = 100
RECOVERY_COST = 200
MAX_SHIELDS  = 5
STREAK_MILESTONES = [7, 14, 21, 30, 50, 100, 365]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_create(user_id: int, db: DBSession) -> StreakShield:
    shield = db.query(StreakShield).filter(StreakShield.user_id == user_id).first()
    if not shield:
        shield = StreakShield(user_id=user_id)
        db.add(shield)
        db.commit()
        db.refresh(shield)
    return shield


def _protected_set(shield: StreakShield) -> set:
    try:
        return {date.fromisoformat(d) for d in json.loads(shield.shield_protected_dates or "[]")}
    except Exception:
        return set()


def _save_protected(shield: StreakShield, dates: set) -> None:
    shield.shield_protected_dates = json.dumps(
        sorted(d.isoformat() for d in dates)
    )


def _streak_from_dates(all_dates: set) -> int:
    streak = 0
    d = date.today()
    while d in all_dates:
        streak += 1
        d -= timedelta(days=1)
    return streak


def _all_covered(entries, protected: set) -> set:
    return {e.date for e in entries} | protected


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
def get_status(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    shield  = _get_or_create(current_user.id, db)
    entries = db.query(LearningData).filter(LearningData.user_id == current_user.id).all()
    protected = _protected_set(shield)
    covered   = _all_covered(entries, protected)

    today     = date.today()
    yesterday = today - timedelta(days=1)
    day_before = yesterday - timedelta(days=1)

    streak     = _streak_from_dates(covered)
    last_checkin = max((e.date for e in entries), default=None) if entries else None

    # Auto-set recovery deadline when gap is detected via status poll
    if (yesterday not in covered and day_before in covered
            and shield.shield_count == 0
            and not shield.streak_recovery_deadline):
        now_m = today.month
        now_y = today.year
        not_used_this_month = not (
            shield.recovery_used_month == now_m and shield.recovery_used_year == now_y
        )
        if not_used_this_month:
            shield.streak_recovery_deadline = datetime.utcnow() + timedelta(hours=24)
            db.commit()
            notify_recovery_available(db, current_user.id, yesterday)

    now_m = today.month
    now_y = today.year
    recovery_used_this_month = (
        shield.recovery_used_month == now_m and shield.recovery_used_year == now_y
    )
    can_recover = (
        bool(shield.streak_recovery_deadline)
        and datetime.utcnow() < shield.streak_recovery_deadline
        and not recovery_used_this_month
    )

    next_milestone = next((m for m in STREAK_MILESTONES if m > streak), None)
    prog = compute_progress(current_user.id, db)

    return {
        "shield_count":            shield.shield_count,
        "auto_use_shield":         shield.auto_use_shield,
        "streak_days":             streak,
        "last_checkin":            last_checkin.isoformat() if last_checkin else None,
        "can_recover":             can_recover,
        "recovery_deadline":       shield.streak_recovery_deadline.isoformat() if shield.streak_recovery_deadline else None,
        "recovery_used_this_month": recovery_used_this_month,
        "next_milestone":          next_milestone,
        "xp_spent":                shield.xp_spent,
        "available_xp":            max(0, prog["xp"] - shield.xp_spent),
    }


@router.post("/check")
def check_shield_trigger(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """
    Called by frontend right after a check-in is saved.
    Auto-applies shield for a single missed day when auto_use is on,
    or sets recovery deadline when shields are exhausted.
    """
    shield    = _get_or_create(current_user.id, db)
    entries   = db.query(LearningData).filter(LearningData.user_id == current_user.id).all()
    protected = _protected_set(shield)
    covered   = _all_covered(entries, protected)

    today      = date.today()
    yesterday  = today - timedelta(days=1)
    day_before = yesterday - timedelta(days=1)

    shield_used  = False
    recovery_set = False

    # Gap is exactly 1 missed day and we had a streak before
    if yesterday not in covered and day_before in covered:
        if shield.auto_use_shield and shield.shield_count > 0:
            protected.add(yesterday)
            _save_protected(shield, protected)
            shield.shield_count -= 1
            db.commit()
            shield_used = True
            covered = _all_covered(entries, protected)
            notify_shield_used(db, current_user.id, _streak_from_dates(covered), shield.shield_count)
            if shield.shield_count == 0:
                notify_no_shields_warning(db, current_user.id)
        elif shield.shield_count == 0 and not shield.streak_recovery_deadline:
            now_m = today.month
            now_y = today.year
            not_used = not (shield.recovery_used_month == now_m and shield.recovery_used_year == now_y)
            if not_used:
                shield.streak_recovery_deadline = datetime.utcnow() + timedelta(hours=24)
                db.commit()
                recovery_set = True
                notify_recovery_available(db, current_user.id, yesterday)

    streak = _streak_from_dates(_all_covered(entries, _protected_set(shield)))
    return {
        "shield_used":   shield_used,
        "recovery_set":  recovery_set,
        "shield_count":  shield.shield_count,
        "streak_days":   streak,
    }


class _BuyPayload(BaseModel):
    pass


@router.post("/buy-shield")
def buy_shield(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    shield = _get_or_create(current_user.id, db)

    if shield.shield_count >= MAX_SHIELDS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_SHIELDS} shields already in inventory")

    prog          = compute_progress(current_user.id, db)
    available_xp  = prog["xp"] - shield.xp_spent

    if available_xp < SHIELD_COST:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient XP. Need {SHIELD_COST} XP, you have {available_xp}",
        )

    shield.shield_count += 1
    shield.xp_spent     += SHIELD_COST
    db.commit()

    notify_shield_earned(db, current_user.id, shield.shield_count)

    return {
        "ok":           True,
        "shield_count": shield.shield_count,
        "xp_spent":     shield.xp_spent,
        "available_xp": available_xp - SHIELD_COST,
    }


@router.post("/recover-streak")
def recover_streak(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    shield = _get_or_create(current_user.id, db)
    today  = date.today()

    if not shield.streak_recovery_deadline:
        raise HTTPException(status_code=400, detail="No active recovery window")

    if datetime.utcnow() > shield.streak_recovery_deadline:
        shield.streak_recovery_deadline = None
        db.commit()
        raise HTTPException(status_code=400, detail="Recovery window expired (24 hours)")

    now_m = today.month
    now_y = today.year
    if shield.recovery_used_month == now_m and shield.recovery_used_year == now_y:
        raise HTTPException(status_code=400, detail="Streak recovery already used this month")

    prog         = compute_progress(current_user.id, db)
    available_xp = prog["xp"] - shield.xp_spent

    if available_xp < RECOVERY_COST:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient XP. Need {RECOVERY_COST} XP, you have {available_xp}",
        )

    yesterday = today - timedelta(days=1)
    protected = _protected_set(shield)
    protected.add(yesterday)
    _save_protected(shield, protected)

    shield.xp_spent                = shield.xp_spent + RECOVERY_COST
    shield.recovery_used_month     = now_m
    shield.recovery_used_year      = now_y
    shield.streak_recovery_deadline = None
    db.commit()

    entries = db.query(LearningData).filter(LearningData.user_id == current_user.id).all()
    streak  = _streak_from_dates(_all_covered(entries, protected))

    return {
        "ok":            True,
        "recovered_date": yesterday.isoformat(),
        "streak_days":   streak,
        "xp_spent":      RECOVERY_COST,
        "available_xp":  available_xp - RECOVERY_COST,
    }


class _SettingsPayload(BaseModel):
    auto_use: bool


@router.put("/settings")
def update_settings(
    payload: _SettingsPayload,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    shield = _get_or_create(current_user.id, db)
    shield.auto_use_shield = payload.auto_use
    db.commit()
    return {"ok": True, "auto_use_shield": shield.auto_use_shield}


@router.post("/grant-shield")
def grant_shield_internal(
    count: int = 1,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Grant shields (used by achievement system)."""
    shield = _get_or_create(current_user.id, db)
    prev   = shield.shield_count
    shield.shield_count = min(MAX_SHIELDS, prev + count)
    db.commit()
    granted = shield.shield_count - prev
    if granted > 0:
        notify_shield_earned(db, current_user.id, shield.shield_count)
    return {"ok": True, "shield_count": shield.shield_count, "granted": granted}
