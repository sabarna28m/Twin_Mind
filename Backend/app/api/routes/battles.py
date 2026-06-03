import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session as DBSession

from app.api.routes.auth import get_current_user
from app.api.routes.gamification import (
    LEVEL_NAMES, _compute_streak, compute_progress, xp_to_level,
)
from app.core.database import get_db
from app.models.battle import Battle
from app.models.learning_data import LearningData
from app.models.quiz import QuizSession
from app.models.user import User

router = APIRouter(prefix="/battles", tags=["battles"])

DURATION_MAP = {
    "24hr": timedelta(hours=24),
    "48hr": timedelta(hours=48),
    "1week": timedelta(weeks=1),
}
BATTLE_TYPES = {"quiz", "study_hours", "streak"}


# ── Helpers ────────────────────────────────────────────────────────────────
def _gen_invite_code(db: DBSession) -> str:
    chars = string.ascii_uppercase + string.digits
    for _ in range(100):
        code = "".join(secrets.choice(chars) for _ in range(8))
        if not db.query(Battle).filter(Battle.invite_code == code).first():
            return code
    raise RuntimeError("Could not generate unique invite code")


def _get_battle_progress(user_id: int, battle: Battle, db: DBSession) -> dict:
    if not battle.started_at:
        return {"value": 0.0, "target": battle.target_value, "progress_pct": 0}

    started = battle.started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    started_date = started.date()

    btype = battle.battle_type
    if btype == "study_hours":
        entries = db.query(LearningData).filter(
            LearningData.user_id == user_id,
            LearningData.date >= started_date,
        ).all()
        value = round(sum(e.study_hours for e in entries), 2)

    elif btype == "quiz":
        quizzes = db.query(QuizSession).filter(
            QuizSession.user_id == user_id,
            QuizSession.created_at >= started,
            QuizSession.score.isnot(None),
            QuizSession.total.isnot(None),
        ).all()
        valid = [q for q in quizzes if q.total and q.total > 0]
        value = round(sum((q.score / q.total * 100) for q in valid) / len(valid), 2) if valid else 0.0

    elif btype == "streak":
        all_entries = db.query(LearningData).filter(LearningData.user_id == user_id).all()
        value = float(_compute_streak(all_entries))

    else:
        value = 0.0

    target = battle.target_value
    pct = min(100, round(value / target * 100)) if target > 0 else 0
    return {"value": value, "target": target, "progress_pct": pct}


def _maybe_complete(battle: Battle, db: DBSession) -> Battle:
    if battle.status != "active" or not battle.expires_at:
        return battle

    now = datetime.now(timezone.utc)
    expires = battle.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if now < expires:
        return battle

    c_prog = _get_battle_progress(battle.challenger_id, battle, db)
    o_prog = _get_battle_progress(battle.opponent_id, battle, db) if battle.opponent_id else None

    if o_prog is None:
        battle.winner_id = battle.challenger_id
    elif c_prog["value"] > o_prog["value"]:
        battle.winner_id = battle.challenger_id
    elif o_prog["value"] > c_prog["value"]:
        battle.winner_id = battle.opponent_id
    else:
        battle.winner_id = None  # tie

    battle.status = "completed"
    battle.completed_at = now
    db.commit()
    db.refresh(battle)
    return battle


def _battle_dict(battle: Battle, me_id: int, db: DBSession) -> dict:
    battle = _maybe_complete(battle, db)

    challenger = db.query(User).filter(User.id == battle.challenger_id).first()
    opponent = db.query(User).filter(User.id == battle.opponent_id).first() if battle.opponent_id else None
    winner = db.query(User).filter(User.id == battle.winner_id).first() if battle.winner_id else None

    c_prog = _get_battle_progress(battle.challenger_id, battle, db)
    o_prog = _get_battle_progress(battle.opponent_id, battle, db) if battle.opponent_id else None

    return {
        "id": battle.id,
        "battle_type": battle.battle_type,
        "target_value": battle.target_value,
        "duration": battle.duration,
        "status": battle.status,
        "invite_code": battle.invite_code,
        "is_random": battle.is_random,
        "created_at": battle.created_at.isoformat() if battle.created_at else None,
        "expires_at": battle.expires_at.isoformat() if battle.expires_at else None,
        "started_at": battle.started_at.isoformat() if battle.started_at else None,
        "completed_at": battle.completed_at.isoformat() if battle.completed_at else None,
        "challenger": {
            "id": challenger.id, "name": challenger.full_name, "is_me": challenger.id == me_id
        } if challenger else None,
        "opponent": {
            "id": opponent.id, "name": opponent.full_name, "is_me": opponent.id == me_id
        } if opponent else None,
        "winner": {
            "id": winner.id, "name": winner.full_name, "is_me": winner.id == me_id
        } if winner else None,
        "challenger_progress": c_prog,
        "opponent_progress": o_prog,
        "is_challenger": battle.challenger_id == me_id,
    }


# ── Schemas ────────────────────────────────────────────────────────────────
class CreateBattlePayload(BaseModel):
    battle_type: str
    target_value: float
    duration: str
    is_random: bool = False


class JoinBattlePayload(BaseModel):
    invite_code: str


# ── Routes ─────────────────────────────────────────────────────────────────
@router.post("/create")
def create_battle(
    payload: CreateBattlePayload,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if payload.battle_type not in BATTLE_TYPES:
        raise HTTPException(status_code=400, detail=f"battle_type must be one of: {BATTLE_TYPES}")
    if payload.duration not in DURATION_MAP:
        raise HTTPException(status_code=400, detail="duration must be: 24hr, 48hr, or 1week")
    if payload.target_value <= 0:
        raise HTTPException(status_code=400, detail="target_value must be positive")

    invite_code = _gen_invite_code(db)
    battle = Battle(
        challenger_id=current_user.id,
        battle_type=payload.battle_type,
        target_value=payload.target_value,
        duration=payload.duration,
        status="pending",
        invite_code=invite_code,
        is_random=payload.is_random,
        created_at=datetime.now(timezone.utc),
    )
    db.add(battle)
    db.commit()
    db.refresh(battle)
    return _battle_dict(battle, current_user.id, db)


@router.post("/join")
def join_battle(
    payload: JoinBattlePayload,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    battle = db.query(Battle).filter(
        Battle.invite_code == payload.invite_code.strip().upper()
    ).first()
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found — check your invite code")
    if battle.status != "pending":
        raise HTTPException(status_code=400, detail="This battle is no longer open to join")
    if battle.challenger_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot join your own battle")

    now = datetime.now(timezone.utc)
    battle.opponent_id = current_user.id
    battle.status = "active"
    battle.started_at = now
    battle.expires_at = now + DURATION_MAP[battle.duration]
    db.commit()
    db.refresh(battle)
    return _battle_dict(battle, current_user.id, db)


@router.post("/random")
def random_battle(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    # Try to join an existing random pending battle from another user
    existing = (
        db.query(Battle)
        .filter(
            Battle.is_random == True,  # noqa: E712
            Battle.status == "pending",
            Battle.challenger_id != current_user.id,
        )
        .first()
    )

    now = datetime.now(timezone.utc)
    if existing:
        existing.opponent_id = current_user.id
        existing.status = "active"
        existing.started_at = now
        existing.expires_at = now + DURATION_MAP[existing.duration]
        db.commit()
        db.refresh(existing)
        return {**_battle_dict(existing, current_user.id, db), "matched": True}

    # Create a random battle for the user to wait in
    invite_code = _gen_invite_code(db)
    battle = Battle(
        challenger_id=current_user.id,
        battle_type="study_hours",
        target_value=5.0,
        duration="48hr",
        status="pending",
        invite_code=invite_code,
        is_random=True,
        created_at=now,
    )
    db.add(battle)
    db.commit()
    db.refresh(battle)
    return {**_battle_dict(battle, current_user.id, db), "matched": False}


@router.get("/my-battles")
def get_my_battles(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    battles = (
        db.query(Battle)
        .filter(or_(Battle.challenger_id == current_user.id, Battle.opponent_id == current_user.id))
        .order_by(Battle.created_at.desc())
        .limit(50)
        .all()
    )
    return [_battle_dict(b, current_user.id, db) for b in battles]


@router.get("/leaderboard")
def get_leaderboard(
    period: str = "weekly",
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if period not in ("weekly", "monthly", "all_time"):
        period = "weekly"

    now = datetime.now(timezone.utc)
    since_dt = {
        "weekly": now - timedelta(days=7),
        "monthly": now - timedelta(days=30),
        "all_time": None,
    }[period]

    users = db.query(User).filter(User.is_active == True).all()  # noqa: E712
    entries = []

    for u in users:
        all_ld = db.query(LearningData).filter(LearningData.user_id == u.id).all()
        streak = _compute_streak(all_ld)

        if since_dt is not None:
            since_date = since_dt.date()
            period_ld = [e for e in all_ld if e.date >= since_date]
            period_quizzes = db.query(QuizSession).filter(
                QuizSession.user_id == u.id,
                QuizSession.created_at >= since_dt,
                QuizSession.score.isnot(None),
            ).all()
            high_scores = sum(1 for q in period_quizzes if q.total and (q.score / q.total) >= 0.8)
            xp = (
                len(period_ld) * 10
                + len(period_quizzes) * 20
                + high_scores * 30
                + streak * 5
            )
            study_hours = round(sum(e.study_hours for e in period_ld), 1)
        else:
            prog = compute_progress(u.id, db)
            xp = prog["xp"]
            study_hours = round(sum(e.study_hours for e in all_ld), 1)

        level = xp_to_level(xp)
        entries.append({
            "user_id": u.id,
            "username": u.full_name,
            "xp": xp,
            "level": level,
            "level_name": LEVEL_NAMES[level],
            "streak_days": streak,
            "study_hours": study_hours,
            "is_current_user": u.id == current_user.id,
        })

    entries.sort(key=lambda e: e["xp"], reverse=True)
    for i, e in enumerate(entries):
        e["rank"] = i + 1

    return {"period": period, "entries": entries[:50]}
