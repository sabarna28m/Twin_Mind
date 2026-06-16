import math
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.models.user import User
from app.models.skill_tree import NodeProgress, XPTransaction, SkillTreeAchievement
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/skill-tree", tags=["skill-tree"])

# ── Static tree definition ─────────────────────────────────────────────────────
# Each node: id, parent_id, name, icon, description, xp_required, unlock_threshold (% parent needed)

NODES: list[dict[str, Any]] = [
    # Root
    {
        "id": "comm_mastery", "parent_id": None, "level": 0,
        "name": "Communication Mastery", "icon": "🌟",
        "description": "The foundation of all communication skills",
        "xp_required": 0, "unlock_threshold": 0,
        "x": 500, "y": 80,
    },
    # Level 1
    {
        "id": "grammar", "parent_id": "comm_mastery", "level": 1,
        "name": "Grammar", "icon": "📝",
        "description": "Master the rules of language structure",
        "xp_required": 50, "unlock_threshold": 0,
        "x": 100, "y": 240,
    },
    {
        "id": "vocabulary", "parent_id": "comm_mastery", "level": 1,
        "name": "Vocabulary", "icon": "📚",
        "description": "Expand your word power",
        "xp_required": 50, "unlock_threshold": 0,
        "x": 300, "y": 240,
    },
    {
        "id": "speaking", "parent_id": "comm_mastery", "level": 1,
        "name": "Speaking", "icon": "🎤",
        "description": "Express yourself with confidence",
        "xp_required": 50, "unlock_threshold": 0,
        "x": 500, "y": 240,
    },
    {
        "id": "listening", "parent_id": "comm_mastery", "level": 1,
        "name": "Listening", "icon": "👂",
        "description": "Sharpen your active listening skills",
        "xp_required": 50, "unlock_threshold": 0,
        "x": 700, "y": 240,
    },
    {
        "id": "pronunciation", "parent_id": "comm_mastery", "level": 1,
        "name": "Pronunciation", "icon": "🔊",
        "description": "Speak clearly and accurately",
        "xp_required": 50, "unlock_threshold": 0,
        "x": 900, "y": 240,
    },
    # Level 2 — Grammar
    {
        "id": "tenses", "parent_id": "grammar", "level": 2,
        "name": "Tenses", "icon": "⏰",
        "description": "Past, present, and future tense usage",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 0, "y": 420,
    },
    {
        "id": "articles", "parent_id": "grammar", "level": 2,
        "name": "Articles", "icon": "🔤",
        "description": "A, an, the — used correctly",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 80, "y": 420,
    },
    {
        "id": "voice", "parent_id": "grammar", "level": 2,
        "name": "Voice", "icon": "🔄",
        "description": "Active and passive constructions",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 160, "y": 420,
    },
    {
        "id": "narration", "parent_id": "grammar", "level": 2,
        "name": "Narration", "icon": "💬",
        "description": "Direct and indirect speech",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 60, "y": 520,
    },
    {
        "id": "modals", "parent_id": "grammar", "level": 2,
        "name": "Modals", "icon": "🎯",
        "description": "Can, could, should, would, must",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 140, "y": 520,
    },
    # Level 2 — Vocabulary
    {
        "id": "daily_words", "parent_id": "vocabulary", "level": 2,
        "name": "Daily Words", "icon": "☀️",
        "description": "Essential everyday vocabulary",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 220, "y": 420,
    },
    {
        "id": "business_vocab", "parent_id": "vocabulary", "level": 2,
        "name": "Business Vocab", "icon": "💼",
        "description": "Professional and corporate language",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 300, "y": 420,
    },
    {
        "id": "academic_vocab", "parent_id": "vocabulary", "level": 2,
        "name": "Academic Vocab", "icon": "🎓",
        "description": "Scholarly and research vocabulary",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 380, "y": 420,
    },
    {
        "id": "idioms", "parent_id": "vocabulary", "level": 2,
        "name": "Idioms", "icon": "🌈",
        "description": "Common idiomatic expressions",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 260, "y": 520,
    },
    {
        "id": "phrasal_verbs", "parent_id": "vocabulary", "level": 2,
        "name": "Phrasal Verbs", "icon": "⚡",
        "description": "Multi-word verb combinations",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 340, "y": 520,
    },
    # Level 2 — Speaking
    {
        "id": "fluency", "parent_id": "speaking", "level": 2,
        "name": "Fluency", "icon": "🌊",
        "description": "Speak smoothly without hesitation",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 420, "y": 420,
    },
    {
        "id": "confidence", "parent_id": "speaking", "level": 2,
        "name": "Confidence", "icon": "💪",
        "description": "Speak with authority and self-assurance",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 500, "y": 420,
    },
    {
        "id": "public_speaking", "parent_id": "speaking", "level": 2,
        "name": "Public Speaking", "icon": "🏛️",
        "description": "Address audiences effectively",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 580, "y": 420,
    },
    {
        "id": "group_discussion", "parent_id": "speaking", "level": 2,
        "name": "Group Discussion", "icon": "👥",
        "description": "Contribute meaningfully in group settings",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 460, "y": 520,
    },
    {
        "id": "interview_speaking", "parent_id": "speaking", "level": 2,
        "name": "Interview Speaking", "icon": "🤝",
        "description": "Ace interviews with clear articulation",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 540, "y": 520,
    },
    # Level 2 — Listening
    {
        "id": "active_listening", "parent_id": "listening", "level": 2,
        "name": "Active Listening", "icon": "🧠",
        "description": "Engage fully with what you hear",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 620, "y": 420,
    },
    {
        "id": "note_taking", "parent_id": "listening", "level": 2,
        "name": "Note Taking", "icon": "✏️",
        "description": "Capture key information while listening",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 700, "y": 420,
    },
    {
        "id": "comprehension", "parent_id": "listening", "level": 2,
        "name": "Comprehension", "icon": "💡",
        "description": "Understand spoken language deeply",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 780, "y": 420,
    },
    {
        "id": "accent_recognition", "parent_id": "listening", "level": 2,
        "name": "Accent Recognition", "icon": "🌍",
        "description": "Understand diverse accents",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 660, "y": 520,
    },
    {
        "id": "speed_listening", "parent_id": "listening", "level": 2,
        "name": "Speed Listening", "icon": "⚡",
        "description": "Process fast-paced speech",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 740, "y": 520,
    },
    # Level 2 — Pronunciation
    {
        "id": "phonetics", "parent_id": "pronunciation", "level": 2,
        "name": "Phonetics", "icon": "🔡",
        "description": "IPA and phonemic awareness",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 820, "y": 420,
    },
    {
        "id": "stress_patterns", "parent_id": "pronunciation", "level": 2,
        "name": "Stress Patterns", "icon": "🎵",
        "description": "Word and sentence stress",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 900, "y": 420,
    },
    {
        "id": "intonation", "parent_id": "pronunciation", "level": 2,
        "name": "Intonation", "icon": "〰️",
        "description": "Rising and falling speech melody",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 980, "y": 420,
    },
    {
        "id": "connected_speech", "parent_id": "pronunciation", "level": 2,
        "name": "Connected Speech", "icon": "🔗",
        "description": "Linking sounds naturally",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 860, "y": 520,
    },
    {
        "id": "accent_neutralization", "parent_id": "pronunciation", "level": 2,
        "name": "Accent Neutral.", "icon": "🎯",
        "description": "Reduce regional accent interference",
        "xp_required": 150, "unlock_threshold": 80,
        "x": 940, "y": 520,
    },
]

NODE_MAP = {n["id"]: n for n in NODES}

XP_REWARDS = {
    "quiz": 50,
    "lesson": 20,
    "task": 30,
    "challenge": 100,
}

ST_ACHIEVEMENTS = [
    {"id": "first_node", "name": "First Step", "icon": "🌱", "color": "#10b981",
     "description": "Unlock your first skill node", "xp_bonus": 25},
    {"id": "grammar_explorer", "name": "Grammar Explorer", "icon": "📝", "color": "#6366f1",
     "description": "Master all Grammar skill nodes", "xp_bonus": 200},
    {"id": "vocabulary_master", "name": "Vocabulary Master", "icon": "📚", "color": "#f59e0b",
     "description": "Master all Vocabulary skill nodes", "xp_bonus": 200},
    {"id": "comm_champion", "name": "Comm Champion", "icon": "🏆", "color": "#ec4899",
     "description": "Reach mastery in 10 nodes", "xp_bonus": 500},
    {"id": "fluency_legend", "name": "Fluency Legend", "icon": "🌟", "color": "#fbbf24",
     "description": "Master all Speaking skill nodes", "xp_bonus": 300},
]

ST_ACH_MAP = {a["id"]: a for a in ST_ACHIEVEMENTS}


def _compute_level(total_xp: int) -> dict:
    level = max(1, int(math.sqrt(total_xp / 100))) if total_xp > 0 else 1
    level = min(level, 50)
    xp_for_level = level * level * 100
    xp_next = (level + 1) * (level + 1) * 100
    xp_in_level = total_xp - xp_for_level
    span = xp_next - xp_for_level
    return {
        "level": level,
        "total_xp": total_xp,
        "xp_in_level": xp_in_level,
        "xp_for_next": xp_next,
        "span": span,
        "progress_pct": round((xp_in_level / span) * 100, 1) if span > 0 else 0,
    }


def _get_progress_map(user_id: int, db: DBSession) -> dict[str, NodeProgress]:
    rows = db.query(NodeProgress).filter(NodeProgress.user_id == user_id).all()
    return {r.node_id: r for r in rows}


def _unlock_available(user_id: int, db: DBSession, progress_map: dict):
    """Set nodes to 'available' when their parent is sufficiently complete."""
    for node in NODES:
        nid = node["id"]
        pid = node["parent_id"]
        if nid in progress_map and progress_map[nid].status != "locked":
            continue
        if pid is None:
            # Root always available
            if nid not in progress_map:
                _upsert_progress(user_id, nid, "available", db)
            continue
        parent = progress_map.get(pid)
        if parent and parent.completion_pct >= node["unlock_threshold"]:
            _upsert_progress(user_id, nid, "available", db)


def _upsert_progress(user_id: int, node_id: str, status: str, db: DBSession,
                     completion_delta: float = 0.0, xp_delta: int = 0,
                     lessons_delta: int = 0, quizzes_delta: int = 0):
    row = db.query(NodeProgress).filter_by(user_id=user_id, node_id=node_id).first()
    if row is None:
        row = NodeProgress(user_id=user_id, node_id=node_id, status=status)
        db.add(row)
    else:
        if status != "locked" or row.status == "locked":
            row.status = status
    row.completion_pct = min(100.0, row.completion_pct + completion_delta)
    row.xp_earned += xp_delta
    row.lessons_completed += lessons_delta
    row.quizzes_completed += quizzes_delta
    if row.completion_pct >= 100:
        row.status = "mastered"
    elif row.completion_pct > 0 and row.status == "available":
        row.status = "in_progress"
    try:
        db.commit()
        db.refresh(row)
    except IntegrityError:
        db.rollback()
    return row


# ── Pydantic schemas ────────────────────────────────────────────────────────────

class ActivityRequest(BaseModel):
    node_id: str
    activity_type: str  # quiz | lesson | task | challenge


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/tree")
def get_skill_tree(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    progress_map = _get_progress_map(current_user.id, db)
    _unlock_available(current_user.id, db, progress_map)
    progress_map = _get_progress_map(current_user.id, db)  # re-fetch after unlocks

    total_xp = db.query(XPTransaction).filter(
        XPTransaction.user_id == current_user.id
    ).all()
    total_xp_sum = sum(t.xp_amount for t in total_xp)

    weekly_xp = sum(
        t.xp_amount for t in total_xp
        if t.created_at and (
            __import__("datetime").datetime.utcnow() - t.created_at.replace(tzinfo=None)
        ).days <= 7
    )

    nodes_out = []
    for node in NODES:
        p = progress_map.get(node["id"])
        nodes_out.append({
            **node,
            "status": p.status if p else "locked",
            "completion_pct": p.completion_pct if p else 0.0,
            "xp_earned": p.xp_earned if p else 0,
            "lessons_completed": p.lessons_completed if p else 0,
            "quizzes_completed": p.quizzes_completed if p else 0,
        })

    earned_ach = {
        r.achievement_id for r in
        db.query(SkillTreeAchievement).filter(
            SkillTreeAchievement.user_id == current_user.id
        ).all()
    }

    return {
        "nodes": nodes_out,
        "xp": _compute_level(total_xp_sum),
        "weekly_xp": weekly_xp,
        "achievements": [
            {**a, "earned": a["id"] in earned_ach}
            for a in ST_ACHIEVEMENTS
        ],
    }


@router.post("/activity")
def record_activity(
    body: ActivityRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if body.node_id not in NODE_MAP:
        raise HTTPException(status_code=404, detail="Unknown node")
    if body.activity_type not in XP_REWARDS:
        raise HTTPException(status_code=400, detail="Invalid activity_type")

    progress_map = _get_progress_map(current_user.id, db)
    prog = progress_map.get(body.node_id)
    if prog is None or prog.status == "locked":
        raise HTTPException(status_code=403, detail="Node is locked")

    xp = XP_REWARDS[body.activity_type]
    completion_gain = {"quiz": 15.0, "lesson": 10.0, "task": 12.0, "challenge": 25.0}[body.activity_type]

    db.add(XPTransaction(
        user_id=current_user.id,
        node_id=body.node_id,
        activity_type=body.activity_type,
        xp_amount=xp,
    ))
    db.commit()

    _upsert_progress(
        current_user.id, body.node_id,
        prog.status if prog.status != "locked" else "in_progress",
        db,
        completion_delta=completion_gain,
        xp_delta=xp,
        lessons_delta=1 if body.activity_type == "lesson" else 0,
        quizzes_delta=1 if body.activity_type == "quiz" else 0,
    )

    # Re-run unlock pass
    progress_map = _get_progress_map(current_user.id, db)
    _unlock_available(current_user.id, db, progress_map)

    # Check achievements
    new_achievements = _check_achievements(current_user.id, db)

    total_xp = sum(
        t.xp_amount for t in db.query(XPTransaction).filter(
            XPTransaction.user_id == current_user.id
        ).all()
    )
    return {
        "xp_gained": xp,
        "total_xp": total_xp,
        "level_info": _compute_level(total_xp),
        "new_achievements": new_achievements,
        "completion_gain": completion_gain,
    }


@router.get("/node/{node_id}")
def get_node_detail(
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if node_id not in NODE_MAP:
        raise HTTPException(status_code=404, detail="Unknown node")
    node = NODE_MAP[node_id]
    progress_map = _get_progress_map(current_user.id, db)
    p = progress_map.get(node_id)

    total_xp = sum(
        t.xp_amount for t in db.query(XPTransaction).filter(
            XPTransaction.user_id == current_user.id
        ).all()
    )

    # Build recommended next activities based on completion
    pct = p.completion_pct if p else 0
    if pct < 30:
        recommended = ["lesson", "lesson", "quiz"]
    elif pct < 70:
        recommended = ["quiz", "task", "lesson"]
    else:
        recommended = ["challenge", "quiz"]

    return {
        **node,
        "status": p.status if p else "locked",
        "completion_pct": p.completion_pct if p else 0.0,
        "xp_earned": p.xp_earned if p else 0,
        "lessons_completed": p.lessons_completed if p else 0,
        "quizzes_completed": p.quizzes_completed if p else 0,
        "level_info": _compute_level(total_xp),
        "recommended_activities": recommended,
        "next_milestone": 100 if pct < 100 else None,
    }


@router.get("/analytics")
def get_analytics(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    progress_map = _get_progress_map(current_user.id, db)
    all_txns = db.query(XPTransaction).filter(
        XPTransaction.user_id == current_user.id
    ).order_by(XPTransaction.created_at).all()

    total_xp = sum(t.xp_amount for t in all_txns)
    mastered = [p for p in progress_map.values() if p.status == "mastered"]
    in_progress = [p for p in progress_map.values() if p.status == "in_progress"]

    # XP by day (last 14)
    from collections import defaultdict
    from datetime import datetime, timedelta
    xp_by_day: dict = defaultdict(int)
    for t in all_txns:
        if t.created_at:
            day = t.created_at.date().isoformat()
            xp_by_day[day] += t.xp_amount

    today = datetime.utcnow().date()
    xp_chart = []
    for i in range(13, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        xp_chart.append({"date": d, "xp": xp_by_day.get(d, 0)})

    # Subject XP grouping
    parent_map = {n["id"]: n["parent_id"] for n in NODES}
    level1 = [n["id"] for n in NODES if n["level"] == 1]
    subject_xp: dict[str, int] = {nid: 0 for nid in level1}
    for t in all_txns:
        if not t.node_id:
            continue
        nid = t.node_id
        while nid and parent_map.get(nid) is not None:
            pid = parent_map[nid]
            if pid == "comm_mastery":
                if nid in subject_xp:
                    subject_xp[nid] += t.xp_amount
                break
            nid = pid

    strongest = max(subject_xp, key=lambda k: subject_xp[k]) if subject_xp else None
    weakest = min(subject_xp, key=lambda k: subject_xp[k]) if subject_xp else None
    node_names = {n["id"]: n["name"] for n in NODES}

    return {
        "total_xp": total_xp,
        "level_info": _compute_level(total_xp),
        "mastered_count": len(mastered),
        "in_progress_count": len(in_progress),
        "total_nodes": len(NODES),
        "completion_pct": round(len(mastered) / len(NODES) * 100, 1),
        "xp_chart": xp_chart,
        "subject_xp": {node_names.get(k, k): v for k, v in subject_xp.items()},
        "strongest_subject": node_names.get(strongest, "") if strongest else "",
        "weakest_subject": node_names.get(weakest, "") if weakest else "",
    }


def _check_achievements(user_id: int, db: DBSession) -> list:
    progress_map = _get_progress_map(user_id, db)
    earned = {
        r.achievement_id for r in
        db.query(SkillTreeAchievement).filter(
            SkillTreeAchievement.user_id == user_id
        ).all()
    }

    new_ids = set()
    mastered_ids = {nid for nid, p in progress_map.items() if p.status == "mastered"}
    unlocked = {nid for nid, p in progress_map.items() if p.status != "locked"}

    if unlocked and "first_node" not in earned:
        new_ids.add("first_node")

    grammar_children = {n["id"] for n in NODES if n["parent_id"] == "grammar"}
    if grammar_children and grammar_children.issubset(mastered_ids) and "grammar_explorer" not in earned:
        new_ids.add("grammar_explorer")

    vocab_children = {n["id"] for n in NODES if n["parent_id"] == "vocabulary"}
    if vocab_children and vocab_children.issubset(mastered_ids) and "vocabulary_master" not in earned:
        new_ids.add("vocabulary_master")

    if len(mastered_ids) >= 10 and "comm_champion" not in earned:
        new_ids.add("comm_champion")

    speaking_children = {n["id"] for n in NODES if n["parent_id"] == "speaking"}
    if speaking_children and speaking_children.issubset(mastered_ids) and "fluency_legend" not in earned:
        new_ids.add("fluency_legend")

    for aid in new_ids:
        try:
            db.add(SkillTreeAchievement(user_id=user_id, achievement_id=aid))
            db.commit()
        except IntegrityError:
            db.rollback()

    return [ST_ACH_MAP[aid] for aid in new_ids if aid in ST_ACH_MAP]
