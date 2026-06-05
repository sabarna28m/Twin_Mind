import json
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from groq import Groq
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.learning_data import LearningData
from app.models.student_profile import StudentProfile
from app.models.smart_plan_record import SmartPlanRecord
from app.api.routes.auth import get_current_user
from app.ml.predictor import predict

router = APIRouter(prefix="/smart-plan", tags=["smart-plan"])

GROQ_MODEL = "llama-3.3-70b-versatile"
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class DayPlan(BaseModel):
    day: str
    tasks: list[str]


class SmartPlanResponse(BaseModel):
    current_score: float
    target_score: float
    daily_hours: float
    forecast: str
    days: list[DayPlan]


def _weak_areas(entry: LearningData, pred: dict) -> list[str]:
    areas = []
    if entry.study_hours < 5:
        areas.append(f"study hours (currently {entry.study_hours}h/day — target 5–6h)")
    if entry.attendance_percentage < 80:
        areas.append(f"attendance (currently {entry.attendance_percentage:.0f}% — target 85%+)")
    if entry.assignment_completion_rate < 75:
        areas.append(f"assignment completion (currently {entry.assignment_completion_rate:.0f}% — target 80%+)")
    qs = entry.quiz_scores
    if qs is not None and qs < 65:
        areas.append(f"quiz performance (currently {qs:.0f}% — target 70%+)")
    if entry.stress_level >= 7:
        areas.append(f"stress management (level {entry.stress_level}/10 — needs reduction)")
    if entry.sleep_duration < 6.5 or entry.sleep_duration > 9:
        areas.append(f"sleep schedule (currently {entry.sleep_duration}h — optimal 7–8h)")
    if not areas:
        areas.append("maintaining current strong performance across all areas")
    return areas


def _extract_json(text: str) -> dict:
    # Strip markdown code fences
    clean = re.sub(r"```(?:json)?", "", text).strip()
    # Find first {...} block
    m = re.search(r"\{[\s\S]*\}", clean)
    if m:
        return json.loads(m.group(0))
    raise ValueError("No JSON object found in response")


def _build_prompt(
    entry: LearningData,
    pred: dict,
    profile: Optional[StudentProfile],
    weak_areas: list[str],
) -> str:
    course = profile.course if profile else "General Studies"
    goals = profile.academic_goals if profile else "Improve academic performance"
    subjects = profile.subjects if profile else ""
    subject_line = f"- Enrolled subjects: {subjects}" if subjects else ""

    weak_str = "\n".join(f"  • {a}" for a in weak_areas)
    current = pred["predicted_score"]
    target = min(round(current + 10 + (100 - current) * 0.05, 1), 95.0)

    return f"""You are TwinMind AI, a precision study-plan generator.

Student Profile:
- Course: {course}
- Academic goal: {goals}
{subject_line}

Current Performance Data:
- Predicted exam score: {current}%
- Daily study hours: {entry.study_hours}h
- Attendance: {entry.attendance_percentage:.0f}%
- Assignment completion: {entry.assignment_completion_rate:.0f}%
- Quiz scores: {f"{entry.quiz_scores:.0f}%" if entry.quiz_scores is not None else "N/A"}
- Sleep: {entry.sleep_duration}h/night
- Stress: {entry.stress_level}/10
- Risk level: {pred["risk_level"]}

Weak areas to address:
{weak_str}

Generate a personalized 7-day study schedule. Return ONLY a valid JSON object with this EXACT structure, no markdown, no text outside the JSON:

{{
  "current_score": {current},
  "target_score": {target},
  "daily_hours": <recommended hours as a number, e.g. 4.5>,
  "forecast": "<one concise sentence about the performance outlook>",
  "days": [
    {{"day": "Monday", "tasks": ["<specific task 1>", "<specific task 2>", "<specific task 3>"]}},
    {{"day": "Tuesday", "tasks": ["<specific task 1>", "<specific task 2>", "<specific task 3>"]}},
    {{"day": "Wednesday", "tasks": ["<specific task 1>", "<specific task 2>", "<specific task 3>"]}},
    {{"day": "Thursday", "tasks": ["<specific task 1>", "<specific task 2>", "<specific task 3>"]}},
    {{"day": "Friday", "tasks": ["<specific task 1>", "<specific task 2>", "<specific task 3>"]}},
    {{"day": "Saturday", "tasks": ["<specific task 1>", "<specific task 2>"]}},
    {{"day": "Sunday", "tasks": ["<specific task 1>", "<specific task 2>"]}}
  ]
}}

Rules:
- Tasks must be specific and actionable (reference actual subjects from the student's course/profile)
- Address the weakest areas first each day
- Weekday tasks: 3 tasks each; weekend tasks: 2 tasks (lighter schedule)
- daily_hours must be between 3.0 and 7.0
- forecast must be one sentence only
- Return ONLY the raw JSON — no markdown fences, no commentary"""


@router.post("/generate", response_model=SmartPlanResponse)
def generate_smart_plan(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if not settings.groq_api_key:
        raise HTTPException(status_code=503, detail="Groq API key not configured.")

    entries = (
        db.query(LearningData)
        .filter(LearningData.user_id == current_user.id)
        .order_by(LearningData.date.desc())
        .limit(7)
        .all()
    )
    if not entries:
        raise HTTPException(
            status_code=404,
            detail="No learning data found. Log at least one Check-In first.",
        )

    latest = entries[0]
    n = len(entries)
    avg_quiz = (
        sum(e.quiz_scores for e in entries if e.quiz_scores is not None) /
        max(sum(1 for e in entries if e.quiz_scores is not None), 1)
    )
    study_avg  = sum(e.study_hours for e in entries) / n
    attend_avg = sum(e.attendance_percentage for e in entries) / n
    assign_avg = sum(e.assignment_completion_rate for e in entries) / n
    stress_avg = sum(e.stress_level for e in entries) / n
    sleep_avg  = sum(e.sleep_duration for e in entries) / n

    pred = predict(
        study_hours=study_avg,
        attendance_percentage=attend_avg,
        assignment_completion_rate=assign_avg,
        quiz_scores=avg_quiz if avg_quiz > 0 else None,
        stress_level=round(stress_avg),
        sleep_duration=sleep_avg,
    )

    profile = (
        db.query(StudentProfile)
        .filter(StudentProfile.user_id == current_user.id)
        .first()
    )

    weak_areas = _weak_areas(latest, pred)
    prompt = _build_prompt(latest, pred, profile, weak_areas)

    client = Groq(api_key=settings.groq_api_key)
    try:
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1200,
            temperature=0.4,
        )
        raw = resp.choices[0].message.content
        data = _extract_json(raw)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {exc}")

    # Validate / normalise structure
    days_raw = data.get("days", [])
    day_plans = []
    for i, day_name in enumerate(DAYS):
        entry_d = days_raw[i] if i < len(days_raw) else {}
        tasks = entry_d.get("tasks", ["Review your notes", "Practice problems"])
        day_plans.append(DayPlan(day=day_name, tasks=tasks[:3]))

    return SmartPlanResponse(
        current_score=float(data.get("current_score", pred["predicted_score"])),
        target_score=float(data.get("target_score", min(pred["predicted_score"] + 10, 95))),
        daily_hours=float(data.get("daily_hours", 4.0)),
        forecast=str(data.get("forecast", pred["risk_label"])),
        days=day_plans,
    )


@router.post("/save", status_code=204)
def save_smart_plan(
    payload: SmartPlanResponse,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    # Deactivate all previous active plans for this user
    db.query(SmartPlanRecord).filter(
        SmartPlanRecord.user_id == current_user.id,
        SmartPlanRecord.is_active == True,  # noqa: E712
    ).update({"is_active": False})

    record = SmartPlanRecord(
        user_id=current_user.id,
        plan_content=json.dumps(payload.model_dump()),
        is_active=True,
    )
    db.add(record)
    db.commit()


@router.get("/current", response_model=SmartPlanResponse)
def get_current_smart_plan(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    record = (
        db.query(SmartPlanRecord)
        .filter(
            SmartPlanRecord.user_id == current_user.id,
            SmartPlanRecord.is_active == True,  # noqa: E712
        )
        .order_by(SmartPlanRecord.generated_at.desc())
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="No saved plan found.")

    data = json.loads(record.plan_content)
    return SmartPlanResponse(**data)
