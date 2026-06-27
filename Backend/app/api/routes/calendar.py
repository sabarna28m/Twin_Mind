import os
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

# Allow OAuth over plain HTTP for local development
os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.google_token import GoogleToken
from app.models.study_plan import StudyPlan
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/calendar", tags=["calendar"])

_SCOPES = ["https://www.googleapis.com/auth/calendar.events"]
_TOKEN_URI = "https://oauth2.googleapis.com/token"


def _get_flow():
    from google_auth_oauthlib.flow import Flow
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uris": [settings.google_redirect_uri],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": _TOKEN_URI,
            }
        },
        scopes=_SCOPES,
        redirect_uri=settings.google_redirect_uri,
    )


def _build_service(token_record: GoogleToken, db: DBSession):
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    creds = Credentials(
        token=token_record.access_token,
        refresh_token=token_record.refresh_token,
        token_uri=_TOKEN_URI,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=_SCOPES,
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        token_record.access_token = creds.token
        db.commit()
    return build("calendar", "v3", credentials=creds)


@router.get("/status")
def get_status(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    configured = bool(settings.google_client_id and settings.google_client_secret)
    token = db.query(GoogleToken).filter(GoogleToken.user_id == current_user.id).first()
    return {
        "configured": configured,
        "connected": token is not None,
        "connected_at": token.created_at.isoformat() if token and token.created_at else None,
    }


@router.get("/auth-url")
def get_auth_url(current_user: User = Depends(get_current_user)):
    if not settings.google_client_id:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env file.",
        )
    flow = _get_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=str(current_user.id),
    )
    return {"auth_url": auth_url}


@router.get("/callback")
def oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: DBSession = Depends(get_db),
):
    try:
        user_id = int(state)
    except ValueError:
        return RedirectResponse(f"{settings.frontend_url}/profile?calendar=error")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return RedirectResponse(f"{settings.frontend_url}/profile?calendar=error")

    try:
        flow = _get_flow()
        flow.fetch_token(code=code)
        creds = flow.credentials

        token_record = db.query(GoogleToken).filter(GoogleToken.user_id == user_id).first()
        expiry_str = creds.expiry.isoformat() if creds.expiry else None
        if token_record:
            token_record.access_token = creds.token
            token_record.refresh_token = creds.refresh_token or token_record.refresh_token
            token_record.token_expiry = expiry_str
        else:
            token_record = GoogleToken(
                user_id=user_id,
                access_token=creds.token,
                refresh_token=creds.refresh_token,
                token_expiry=expiry_str,
            )
            db.add(token_record)
        db.commit()
    except Exception:
        return RedirectResponse(f"{settings.frontend_url}/profile?calendar=error")

    return RedirectResponse(f"{settings.frontend_url}/profile?calendar=connected")


@router.post("/disconnect")
def disconnect(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    token_record = db.query(GoogleToken).filter(GoogleToken.user_id == current_user.id).first()
    if token_record:
        db.delete(token_record)
        db.commit()
    return {"ok": True}


class ReminderRequest(BaseModel):
    title: str
    date: str       # YYYY-MM-DD
    time: str       # HH:MM
    description: str = ""


@router.post("/add-reminder")
def add_reminder(
    payload: ReminderRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    token_record = db.query(GoogleToken).filter(GoogleToken.user_id == current_user.id).first()
    if not token_record:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")

    try:
        service = _build_service(token_record, db)
        start_dt = datetime.fromisoformat(f"{payload.date}T{payload.time}:00")
        end_dt = start_dt + timedelta(hours=1)
        event = {
            "summary": payload.title,
            "description": payload.description,
            "start": {"dateTime": start_dt.isoformat(), "timeZone": "UTC"},
            "end": {"dateTime": end_dt.isoformat(), "timeZone": "UTC"},
        }
        result = service.events().insert(calendarId="primary", body=event).execute()
        return {"ok": True, "event_id": result.get("id"), "event_link": result.get("htmlLink")}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to add event: {exc}")


def _parse_study_plan(plan_text: str) -> list:
    pattern = re.compile(r"(?:^|\n)\s*(?:\*{1,2})?[Dd]ay\s+(\d+)(?:\*{1,2})?[:\s]", re.MULTILINE)
    matches = list(pattern.finditer(plan_text))
    if len(matches) >= 2:
        days = []
        for i, m in enumerate(matches):
            day_num = int(m.group(1))
            start = m.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(plan_text)
            content = plan_text[start:end].strip()[:800]
            days.append({"day": day_num, "content": content})
        return days
    # Fallback: 30 days with first 800 chars of plan as description
    snippet = plan_text[:800]
    return [{"day": i + 1, "content": snippet} for i in range(30)]


@router.post("/sync-study-plan")
def sync_study_plan(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    token_record = db.query(GoogleToken).filter(GoogleToken.user_id == current_user.id).first()
    if not token_record:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")

    plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.user_id == current_user.id)
        .order_by(StudyPlan.created_at.desc())
        .first()
    )
    if not plan:
        raise HTTPException(
            status_code=404,
            detail="No study plan found. Generate one in the AI Mentor first.",
        )

    try:
        service = _build_service(token_record, db)
        days = _parse_study_plan(plan.plan_text)
        today = datetime.now(timezone.utc).date()
        created = 0

        for day_info in days:
            event_date = today + timedelta(days=day_info["day"] - 1)
            event = {
                "summary": f"TwinMind Study — Day {day_info['day']}",
                "description": day_info["content"] or "Follow your personalized study plan.",
                "start": {"date": event_date.isoformat()},
                "end": {"date": (event_date + timedelta(days=1)).isoformat()},
                "colorId": "9",
            }
            service.events().insert(calendarId="primary", body=event).execute()
            created += 1

        return {"ok": True, "events_created": created}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Sync failed: {exc}")


@router.get("/upcoming")
def get_upcoming(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    token_record = db.query(GoogleToken).filter(GoogleToken.user_id == current_user.id).first()
    if not token_record:
        return {"events": []}

    try:
        service = _build_service(token_record, db)
        now = datetime.now(timezone.utc).isoformat()
        end_time = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        result = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=now,
                timeMax=end_time,
                maxResults=3,
                q="TwinMind",
                orderBy="startTime",
                singleEvents=True,
            )
            .execute()
        )
        events = []
        for ev in result.get("items", []):
            start = ev.get("start", {})
            events.append(
                {
                    "id": ev.get("id"),
                    "title": ev.get("summary", ""),
                    "start": start.get("dateTime") or start.get("date"),
                    "link": ev.get("htmlLink"),
                }
            )
        return {"events": events}
    except Exception:
        return {"events": []}
