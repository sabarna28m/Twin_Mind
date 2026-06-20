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

# ── Pricing ───────────────────────────────────────────────────────────────────
SHIELD_COST         = 500
PREMIUM_SHIELD_COST = 1200
FREEZE_COST         = 800
DOUBLE_XP_COST      = 1000
RECOVERY_COST       = 200
MAX_SHIELDS         = 5
STREAK_MILESTONES   = [7, 14, 21, 30, 50, 100, 365]


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


def _all_covered(entries, protected: set, shield: StreakShield | None = None) -> set:
    covered = {e.date for e in entries} | protected
    # Streak freeze counts as today being covered
    if shield and shield.streak_freeze_expires:
        if datetime.utcnow() < shield.streak_freeze_expires:
            covered.add(date.today())
    return covered


def _deduct_xp(shield: StreakShield, cost: int, available_xp: int) -> None:
    if available_xp < cost:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient XP. Need {cost} XP, you have {available_xp}",
        )
    shield.xp_spent += cost


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
def get_status(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    shield    = _get_or_create(current_user.id, db)
    entries   = db.query(LearningData).filter(LearningData.user_id == current_user.id).all()
    protected = _protected_set(shield)
    covered   = _all_covered(entries, protected, shield)

    today      = date.today()
    yesterday  = today - timedelta(days=1)
    day_before = yesterday - timedelta(days=1)
    streak     = _streak_from_dates(covered)
    last_checkin = max((e.date for e in entries), default=None) if entries else None

    # Auto-set recovery deadline when gap detected and no shields at all
    no_shields = shield.shield_count == 0 and shield.premium_shield_count == 0
    if (yesterday not in covered and day_before in covered
            and no_shields and not shield.streak_recovery_deadline):
        now_m, now_y = today.month, today.year
        if not (shield.recovery_used_month == now_m and shield.recovery_used_year == now_y):
            shield.streak_recovery_deadline = datetime.utcnow() + timedelta(hours=24)
            db.commit()
            notify_recovery_available(db, current_user.id, yesterday)

    now_m, now_y = today.month, today.year
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
        "premium_shield_count":    shield.premium_shield_count,
        "auto_use_shield":         shield.auto_use_shield,
        "streak_freeze_active":    bool(shield.streak_freeze_expires and datetime.utcnow() < shield.streak_freeze_expires),
        "streak_freeze_expires":   shield.streak_freeze_expires.isoformat() if shield.streak_freeze_expires else None,
        "double_xp_active":        bool(shield.double_xp_expires and datetime.utcnow() < shield.double_xp_expires),
        "double_xp_expires":       shield.double_xp_expires.isoformat() if shield.double_xp_expires else None,
        "streak_days":             streak,
        "last_checkin":            last_checkin.isoformat() if last_checkin else None,
        "can_recover":             can_recover,
        "recovery_deadline":       shield.streak_recovery_deadline.isoformat() if shield.streak_recovery_deadline else None,
        "recovery_used_this_month": recovery_used_this_month,
        "next_milestone":          next_milestone,
        "xp_spent":                shield.xp_spent,
        "available_xp":            max(0, prog["xp"] - shield.xp_spent),
        "pricing": {
            "shield":         SHIELD_COST,
            "premium_shield": PREMIUM_SHIELD_COST,
            "streak_freeze":  FREEZE_COST,
            "double_xp":      DOUBLE_XP_COST,
            "recovery":       RECOVERY_COST,
        },
    }


# ── Shield check (called after check-in) ──────────────────────────────────────

@router.post("/check")
def check_shield_trigger(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    shield    = _get_or_create(current_user.id, db)
    entries   = db.query(LearningData).filter(LearningData.user_id == current_user.id).all()
    protected = _protected_set(shield)
    covered   = _all_covered(entries, protected, shield)

    today      = date.today()
    yesterday  = today - timedelta(days=1)
    day_before = yesterday - timedelta(days=1)

    shield_used  = False
    recovery_set = False
    item_used    = None

    # Detect consecutive gap (up to 3 days for premium shield)
    missing = []
    for i in range(1, 4):
        d = today - timedelta(days=i)
        if d not in covered:
            missing.append(d)
        else:
            break

    if missing and day_before not in covered and len(missing) >= 1:
        # Check if we had a streak before the gap
        base = today - timedelta(days=len(missing) + 1)
        had_streak = base in covered
        if not had_streak:
            missing = []

    if missing:
        gap = len(missing)
        if gap <= 1 and shield.auto_use_shield and shield.shield_count > 0:
            protected |= set(missing)
            _save_protected(shield, protected)
            shield.shield_count -= 1
            db.commit()
            shield_used, item_used = True, "shield"
            covered = _all_covered(entries, protected, shield)
            notify_shield_used(db, current_user.id, _streak_from_dates(covered), shield.shield_count)
            if shield.shield_count == 0 and shield.premium_shield_count == 0:
                notify_no_shields_warning(db, current_user.id)
        elif gap <= 3 and shield.auto_use_shield and shield.premium_shield_count > 0:
            protected |= set(missing)
            _save_protected(shield, protected)
            shield.premium_shield_count -= 1
            db.commit()
            shield_used, item_used = True, "premium_shield"
            covered = _all_covered(entries, protected, shield)
            notify_shield_used(db, current_user.id, _streak_from_dates(covered),
                               shield.shield_count + shield.premium_shield_count)
        elif shield.shield_count == 0 and shield.premium_shield_count == 0 and not shield.streak_recovery_deadline:
            now_m, now_y = today.month, today.year
            if not (shield.recovery_used_month == now_m and shield.recovery_used_year == now_y):
                shield.streak_recovery_deadline = datetime.utcnow() + timedelta(hours=24)
                db.commit()
                recovery_set = True
                notify_recovery_available(db, current_user.id, yesterday)

    streak = _streak_from_dates(_all_covered(entries, _protected_set(shield), shield))
    return {
        "shield_used":   shield_used,
        "item_used":     item_used,
        "recovery_set":  recovery_set,
        "shield_count":  shield.shield_count,
        "streak_days":   streak,
    }


# ── Purchases ─────────────────────────────────────────────────────────────────

@router.post("/buy-shield")
def buy_shield(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    shield = _get_or_create(current_user.id, db)
    if shield.shield_count >= MAX_SHIELDS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_SHIELDS} shields already in inventory")
    prog         = compute_progress(current_user.id, db)
    available_xp = prog["xp"] - shield.xp_spent
    _deduct_xp(shield, SHIELD_COST, available_xp)
    shield.shield_count += 1
    db.commit()
    notify_shield_earned(db, current_user.id, shield.shield_count)
    return {"ok": True, "shield_count": shield.shield_count, "available_xp": available_xp - SHIELD_COST}


@router.post("/buy-premium-shield")
def buy_premium_shield(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    shield = _get_or_create(current_user.id, db)
    if shield.premium_shield_count >= MAX_SHIELDS:
        raise HTTPException(status_code=400, detail="Maximum premium shields reached")
    prog         = compute_progress(current_user.id, db)
    available_xp = prog["xp"] - shield.xp_spent
    _deduct_xp(shield, PREMIUM_SHIELD_COST, available_xp)
    shield.premium_shield_count += 1
    db.commit()
    notify_shield_earned(db, current_user.id, shield.premium_shield_count)
    return {"ok": True, "premium_shield_count": shield.premium_shield_count, "available_xp": available_xp - PREMIUM_SHIELD_COST}


@router.post("/buy-streak-freeze")
def buy_streak_freeze(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    shield = _get_or_create(current_user.id, db)
    if shield.streak_freeze_expires and datetime.utcnow() < shield.streak_freeze_expires:
        raise HTTPException(status_code=400, detail="A streak freeze is already active")
    prog         = compute_progress(current_user.id, db)
    available_xp = prog["xp"] - shield.xp_spent
    _deduct_xp(shield, FREEZE_COST, available_xp)
    # Freeze covers the rest of today (until end of day UTC)
    shield.streak_freeze_expires = datetime.utcnow().replace(hour=23, minute=59, second=59)
    db.commit()
    return {
        "ok": True,
        "streak_freeze_expires": shield.streak_freeze_expires.isoformat(),
        "available_xp": available_xp - FREEZE_COST,
    }


@router.post("/buy-double-xp")
def buy_double_xp(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    shield = _get_or_create(current_user.id, db)
    if shield.double_xp_expires and datetime.utcnow() < shield.double_xp_expires:
        raise HTTPException(status_code=400, detail="A Double XP Boost is already active")
    prog         = compute_progress(current_user.id, db)
    available_xp = prog["xp"] - shield.xp_spent
    _deduct_xp(shield, DOUBLE_XP_COST, available_xp)
    shield.double_xp_expires = datetime.utcnow() + timedelta(hours=24)
    db.commit()
    return {
        "ok": True,
        "double_xp_expires": shield.double_xp_expires.isoformat(),
        "available_xp": available_xp - DOUBLE_XP_COST,
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
    now_m, now_y = today.month, today.year
    if shield.recovery_used_month == now_m and shield.recovery_used_year == now_y:
        raise HTTPException(status_code=400, detail="Streak recovery already used this month")
    prog         = compute_progress(current_user.id, db)
    available_xp = prog["xp"] - shield.xp_spent
    _deduct_xp(shield, RECOVERY_COST, available_xp)
    yesterday = today - timedelta(days=1)
    protected = _protected_set(shield)
    protected.add(yesterday)
    _save_protected(shield, protected)
    shield.recovery_used_month      = now_m
    shield.recovery_used_year       = now_y
    shield.streak_recovery_deadline = None
    db.commit()
    entries = db.query(LearningData).filter(LearningData.user_id == current_user.id).all()
    streak  = _streak_from_dates(_all_covered(entries, protected, shield))
    return {"ok": True, "recovered_date": yesterday.isoformat(), "streak_days": streak, "available_xp": available_xp - RECOVERY_COST}


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
    shield = _get_or_create(current_user.id, db)
    prev   = shield.shield_count
    shield.shield_count = min(MAX_SHIELDS, prev + count)
    db.commit()
    granted = shield.shield_count - prev
    if granted > 0:
        notify_shield_earned(db, current_user.id, shield.shield_count)
    return {"ok": True, "shield_count": shield.shield_count, "granted": granted}
