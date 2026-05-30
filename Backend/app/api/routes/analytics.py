from datetime import datetime, timedelta, timezone
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.models.session import Session
from app.models.note import Note
from app.models.material import Material
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.api.schemas.analytics import AnalyticsResponse, SubjectStat, DayActivity

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsResponse)
def get_analytics(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    sessions = db.query(Session).filter(Session.user_id == current_user.id).all()
    notes_count = db.query(Note).filter(Note.user_id == current_user.id).count()
    materials_count = db.query(Material).filter(Material.user_id == current_user.id).count()

    completed = [s for s in sessions if s.status == "completed"]
    active = [s for s in sessions if s.status == "active"]
    total_minutes = sum(s.duration_minutes or 0 for s in sessions)

    # Subject breakdown
    subject_map: dict[str, dict] = defaultdict(lambda: {"count": 0, "minutes": 0})
    for s in sessions:
        key = s.subject or "Other"
        subject_map[key]["count"] += 1
        subject_map[key]["minutes"] += s.duration_minutes or 0
    subjects = [
        SubjectStat(subject=k, count=v["count"], total_minutes=v["minutes"])
        for k, v in sorted(subject_map.items(), key=lambda x: -x[1]["count"])
    ]

    # Daily activity — last 14 days
    today = datetime.now(timezone.utc).date()
    day_map: dict[str, dict] = {
        str(today - timedelta(days=i)): {"sessions": 0, "minutes": 0}
        for i in range(13, -1, -1)
    }
    for s in sessions:
        if s.created_at:
            day = str(s.created_at.astimezone(timezone.utc).date())
            if day in day_map:
                day_map[day]["sessions"] += 1
                day_map[day]["minutes"] += s.duration_minutes or 0
    activity = [DayActivity(date=d, sessions=v["sessions"], minutes=v["minutes"]) for d, v in day_map.items()]

    return AnalyticsResponse(
        total_sessions=len(sessions),
        completed_sessions=len(completed),
        active_sessions=len(active),
        total_study_minutes=total_minutes,
        total_notes=notes_count,
        total_materials=materials_count,
        subjects=subjects,
        activity_last_14_days=activity,
    )
