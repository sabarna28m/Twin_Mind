import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from groq import Groq
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from app.api.routes.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.note_history import NoteHistory
from app.models.note_version import NoteVersion
from app.models.smart_note import SmartNote
from app.models.student_profile import StudentProfile
from app.models.user import User

router = APIRouter(prefix="/smart-notes", tags=["smart-notes"])

GROQ_MODEL = "llama-3.3-70b-versatile"
_groq: Optional[Groq] = None


def _get_groq() -> Groq:
    global _groq
    if _groq is None:
        _groq = Groq(api_key=settings.groq_api_key)
    return _groq


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class SmartNoteCreate(BaseModel):
    title: str = "Untitled Note"
    content: Optional[str] = ""
    subject: Optional[str] = ""
    tags: Optional[List[str]] = []
    is_pinned: Optional[bool] = False


class SmartNoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    subject: Optional[str] = None
    tags: Optional[List[str]] = None
    is_pinned: Optional[bool] = None


class AIRequest(BaseModel):
    action: str          # summarize | keypoints | quiz | flashcards | explain
    content: Optional[str] = None
    title: Optional[str] = None


# ── Serialisers ───────────────────────────────────────────────────────────────

def _s_note(n: SmartNote) -> dict:
    return {
        "id": n.id,
        "user_id": n.user_id,
        "title": n.title,
        "content": n.content or "",
        "subject": n.subject or "",
        "tags": json.loads(n.tags or "[]"),
        "is_pinned": bool(n.is_pinned),
        "version_number": n.version_number or 1,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
    }


def _s_history(h: NoteHistory) -> dict:
    return {
        "id": h.id,
        "user_id": h.user_id,
        "original_note_id": h.original_note_id,
        "title": h.title or "",
        "content": h.content or "",
        "subject": h.subject or "",
        "tags": json.loads(h.tags or "[]"),
        "version_number": h.version_number or 1,
        "original_created_at": h.original_created_at.isoformat() if h.original_created_at else None,
        "deleted_at": h.deleted_at.isoformat() if h.deleted_at else None,
    }


def _s_version(v: NoteVersion) -> dict:
    return {
        "id": v.id,
        "note_id": v.note_id,
        "version_number": v.version_number,
        "title": v.title or "",
        "content": v.content or "",
        "subject": v.subject or "",
        "saved_at": v.saved_at.isoformat() if v.saved_at else None,
    }


def _save_version(db: DBSession, note: SmartNote) -> None:
    v = NoteVersion(
        note_id=note.id,
        user_id=note.user_id,
        version_number=note.version_number or 1,
        title=note.title,
        content=note.content or "",
        subject=note.subject or "",
    )
    db.add(v)
    db.commit()


# ── Static routes first (avoid int-path conflicts) ────────────────────────────

@router.get("/subjects")
def get_subjects(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    profile = db.query(StudentProfile).filter(
        StudentProfile.user_id == current_user.id
    ).first()

    profile_subjects: List[str] = []
    if profile and profile.subjects:
        if isinstance(profile.subjects, list):
            profile_subjects = profile.subjects
        else:
            profile_subjects = [s.strip() for s in str(profile.subjects).split(",") if s.strip()]

    note_subjects = [
        n.subject for n in db.query(SmartNote).filter(
            SmartNote.user_id == current_user.id,
            SmartNote.subject != "",
            SmartNote.subject.isnot(None),
        ).all()
        if n.subject
    ]

    all_subjects = sorted(set(profile_subjects + note_subjects))
    return {"subjects": all_subjects}


@router.get("/history")
def list_history(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    rows = (
        db.query(NoteHistory)
        .filter(NoteHistory.user_id == current_user.id)
        .order_by(NoteHistory.deleted_at.desc())
        .all()
    )
    return [_s_history(h) for h in rows]


@router.get("/analytics")
def get_analytics(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    notes = db.query(SmartNote).filter(SmartNote.user_id == current_user.id).all()
    history = db.query(NoteHistory).filter(NoteHistory.user_id == current_user.id).all()
    versions = db.query(NoteVersion).filter(NoteVersion.user_id == current_user.id).all()

    # Build per-subject stats
    subject_stats: dict = {}
    for note in notes:
        subj = note.subject or "Uncategorized"
        if subj not in subject_stats:
            subject_stats[subj] = {"note_count": 0, "edit_count": 0, "word_count": 0, "pinned": 0}
        subject_stats[subj]["note_count"] += 1
        subject_stats[subj]["word_count"] += len((note.content or "").split())
        if note.is_pinned:
            subject_stats[subj]["pinned"] += 1

    for v in versions:
        matched = next((n for n in notes if n.id == v.note_id), None)
        subj = (matched.subject if matched else None) or "Uncategorized"
        if subj in subject_stats:
            subject_stats[subj]["edit_count"] += 1

    for subj, st in subject_stats.items():
        raw = st["note_count"] * 25 + st["edit_count"] * 10 + min(40, st["word_count"] // 25)
        st["strength"] = min(100, raw)

    # Timeline (last 40 events)
    timeline: List[dict] = []
    for n in notes:
        timeline.append({
            "type": "created",
            "title": n.title,
            "subject": n.subject or "",
            "date": n.created_at.isoformat() if n.created_at else None,
        })
        if n.updated_at and n.updated_at != n.created_at and n.version_number and n.version_number > 1:
            timeline.append({
                "type": "edited",
                "title": n.title,
                "subject": n.subject or "",
                "date": n.updated_at.isoformat() if n.updated_at else None,
            })
    for h in history:
        timeline.append({
            "type": "deleted",
            "title": h.title,
            "subject": h.subject or "",
            "date": h.deleted_at.isoformat() if h.deleted_at else None,
        })

    timeline.sort(key=lambda x: x.get("date") or "", reverse=True)

    return {
        "total_notes": len(notes),
        "total_deleted": len(history),
        "total_versions": len(versions),
        "pinned_count": sum(1 for n in notes if n.is_pinned),
        "subject_stats": subject_stats,
        "timeline": timeline[:40],
    }


# ── Note CRUD ─────────────────────────────────────────────────────────────────

@router.get("")
def list_notes(
    subject: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    pinned_only: bool = Query(False),
    sort_by: str = Query("updated"),   # updated | created | title
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    q = db.query(SmartNote).filter(SmartNote.user_id == current_user.id)
    if subject:
        q = q.filter(SmartNote.subject == subject)
    if pinned_only:
        q = q.filter(SmartNote.is_pinned == True)  # noqa: E712
    if search:
        like = f"%{search}%"
        q = q.filter(SmartNote.title.ilike(like) | SmartNote.content.ilike(like))

    if sort_by == "created":
        q = q.order_by(SmartNote.created_at.desc())
    elif sort_by == "title":
        q = q.order_by(SmartNote.title.asc())
    else:
        q = q.order_by(SmartNote.is_pinned.desc(), SmartNote.updated_at.desc())

    return [_s_note(n) for n in q.all()]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_note(
    payload: SmartNoteCreate,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    note = SmartNote(
        user_id=current_user.id,
        title=payload.title or "Untitled Note",
        content=payload.content or "",
        subject=payload.subject or "",
        tags=json.dumps(payload.tags or []),
        is_pinned=payload.is_pinned or False,
        version_number=1,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    _save_version(db, note)
    return _s_note(note)


@router.put("/{note_id}")
def update_note(
    note_id: int,
    payload: SmartNoteUpdate,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    note = db.query(SmartNote).filter(
        SmartNote.id == note_id, SmartNote.user_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    content_changed = False
    if payload.title is not None:
        note.title = payload.title
        content_changed = True
    if payload.content is not None:
        note.content = payload.content
        content_changed = True
    if payload.subject is not None:
        note.subject = payload.subject
        content_changed = True
    if payload.tags is not None:
        note.tags = json.dumps(payload.tags)
    if payload.is_pinned is not None:
        note.is_pinned = payload.is_pinned

    if content_changed:
        note.version_number = (note.version_number or 1) + 1
        note.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(note)

    if content_changed:
        _save_version(db, note)

    return _s_note(note)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    note = db.query(SmartNote).filter(
        SmartNote.id == note_id, SmartNote.user_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    # Archive before deleting
    db.add(NoteHistory(
        user_id=current_user.id,
        original_note_id=note.id,
        title=note.title,
        content=note.content or "",
        subject=note.subject or "",
        tags=note.tags or "[]",
        version_number=note.version_number or 1,
        original_created_at=note.created_at,
    ))

    db.query(NoteVersion).filter(NoteVersion.note_id == note_id).delete()
    db.delete(note)
    db.commit()


# ── History ───────────────────────────────────────────────────────────────────

@router.post("/history/{history_id}/restore", status_code=status.HTTP_201_CREATED)
def restore_note(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    entry = db.query(NoteHistory).filter(
        NoteHistory.id == history_id, NoteHistory.user_id == current_user.id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")

    note = SmartNote(
        user_id=current_user.id,
        title=entry.title,
        content=entry.content or "",
        subject=entry.subject or "",
        tags=entry.tags or "[]",
        is_pinned=False,
        version_number=1,
    )
    db.add(note)
    db.delete(entry)
    db.commit()
    db.refresh(note)
    _save_version(db, note)
    return _s_note(note)


@router.delete("/history/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
def permanent_delete(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    entry = db.query(NoteHistory).filter(
        NoteHistory.id == history_id, NoteHistory.user_id == current_user.id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")
    db.delete(entry)
    db.commit()


# ── Versions ──────────────────────────────────────────────────────────────────

@router.get("/{note_id}/versions")
def list_versions(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    note = db.query(SmartNote).filter(
        SmartNote.id == note_id, SmartNote.user_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    rows = (
        db.query(NoteVersion)
        .filter(NoteVersion.note_id == note_id)
        .order_by(NoteVersion.version_number.desc())
        .all()
    )
    return [_s_version(v) for v in rows]


@router.post("/{note_id}/versions/{version_id}/restore")
def restore_version(
    note_id: int,
    version_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    note = db.query(SmartNote).filter(
        SmartNote.id == note_id, SmartNote.user_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    ver = db.query(NoteVersion).filter(
        NoteVersion.id == version_id, NoteVersion.note_id == note_id
    ).first()
    if not ver:
        raise HTTPException(status_code=404, detail="Version not found")

    note.title = ver.title
    note.content = ver.content
    note.subject = ver.subject or note.subject
    note.version_number = (note.version_number or 1) + 1
    note.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(note)
    _save_version(db, note)
    return _s_note(note)


# ── AI ────────────────────────────────────────────────────────────────────────

_PROMPTS = {
    "summarize": (
        "Summarize the following note concisely in 3-5 sentences, capturing the core ideas.\n\n"
        "Title: {title}\n\nContent:\n{content}\n\nProvide a clear, structured summary."
    ),
    "keypoints": (
        "Extract 5-8 key points from this note as a numbered list.\n\n"
        "Title: {title}\n\nContent:\n{content}\n\n"
        "Return ONLY the numbered points, one per line, no extra text."
    ),
    "quiz": (
        "Generate exactly 5 multiple-choice quiz questions from this note.\n\n"
        "Title: {title}\n\nContent:\n{content}\n\n"
        "Format:\nQ1: [Question]\nA) ...\nB) ...\nC) ...\nD) ...\nAnswer: [letter]\n\nRepeat for Q2-Q5."
    ),
    "flashcards": (
        "Create exactly 6 flashcards from this note.\n\n"
        "Title: {title}\n\nContent:\n{content}\n\n"
        "Format:\nCARD 1\nFront: [term or question]\nBack: [definition or answer]\n\nRepeat for cards 2-6."
    ),
    "explain": (
        "Identify the 3-5 hardest concepts in this note and explain each in simple terms.\n\n"
        "Title: {title}\n\nContent:\n{content}\n\n"
        "For each: 1) Name it, 2) Plain-English explanation, 3) A real-world analogy."
    ),
}


@router.post("/{note_id}/ai")
def ai_action(
    note_id: int,
    payload: AIRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if not settings.groq_api_key:
        raise HTTPException(status_code=503, detail="AI service not configured")

    note = db.query(SmartNote).filter(
        SmartNote.id == note_id, SmartNote.user_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    template = _PROMPTS.get(payload.action)
    if not template:
        raise HTTPException(status_code=400, detail=f"Unknown action: {payload.action}")

    content = (payload.content or note.content or "")[:6000]
    title = payload.title or note.title

    if not content.strip():
        raise HTTPException(status_code=400, detail="Note content is empty")

    prompt = template.format(title=title, content=content)

    try:
        resp = _get_groq().chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert academic tutor and study assistant. "
                        "Help students learn effectively with clear, structured responses."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=1500,
            temperature=0.7,
        )
        result = resp.choices[0].message.content or ""
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI request failed: {exc}") from exc

    return {"action": payload.action, "result": result, "note_id": note_id}
