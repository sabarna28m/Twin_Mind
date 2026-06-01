import json
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from google import genai
from google.genai import types

from app.core.config import settings
from app.core.database import get_db
from app.api.routes.auth import get_current_user
from app.models.quiz import QuizSession
from app.models.user import User

router = APIRouter(prefix="/quiz", tags=["quiz"])

_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


DURATION_TO_QUESTIONS = {10: 10, 20: 20, 30: 30, 60: 60}


# ── Schemas ──────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    subject: str
    duration_minutes: int
    difficulty: str  # Easy | Medium | Hard


class QuestionAnswer(BaseModel):
    question: str
    options: list[str]
    correct: int


class SubmitRequest(BaseModel):
    subject: str
    duration_minutes: int
    difficulty: str
    questions: list[dict]
    user_answers: list[Optional[int]]  # index of chosen option per question (None = skipped)
    time_taken: int  # seconds actually spent


# ── Endpoints ─────────────────────────────────────────────────────────

@router.post("/generate")
def generate_quiz(
    req: GenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    num_q = DURATION_TO_QUESTIONS.get(req.duration_minutes, 10)
    difficulty = req.difficulty if req.difficulty in ("Easy", "Medium", "Hard") else "Medium"

    prompt = f"""Generate exactly {num_q} multiple-choice quiz questions on the subject "{req.subject}" at {difficulty} difficulty.

Return ONLY a raw JSON array — no markdown, no code fences, no explanation — in this exact format:
[
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0
  }}
]

Rules:
- "correct" is the 0-based index of the correct option (0, 1, 2, or 3)
- All 4 options must be distinct and plausible
- {"Questions should test basic recall and straightforward concepts." if difficulty == "Easy" else "Questions should test applied understanding and moderate reasoning." if difficulty == "Medium" else "Questions should test deep understanding, edge cases, and multi-step reasoning."}
- Return exactly {num_q} questions, no more, no less
- Output only the JSON array, nothing else"""

    client = _get_client()

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config=types.GenerateContentConfig(
                max_output_tokens=6000,
                temperature=0.35,
            ),
        )

        raw = response.text.strip()
        # Strip accidental markdown code fences
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw.strip())

        questions = json.loads(raw)

        if not isinstance(questions, list):
            raise ValueError("Response is not a JSON array")

        validated = []
        for i, q in enumerate(questions):
            if not isinstance(q, dict):
                raise ValueError(f"Question {i} is not an object")
            if not all(k in q for k in ("question", "options", "correct")):
                raise ValueError(f"Question {i} missing required keys")
            if not isinstance(q["options"], list) or len(q["options"]) != 4:
                raise ValueError(f"Question {i} must have exactly 4 options")
            if not isinstance(q["correct"], int) or q["correct"] not in (0, 1, 2, 3):
                raise ValueError(f"Question {i} 'correct' must be 0-3")
            validated.append({
                "question": str(q["question"]),
                "options": [str(o) for o in q["options"]],
                "correct": int(q["correct"]),
            })

        return {"questions": validated, "total": len(validated)}

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Gemini returned invalid JSON: {e}")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=f"Invalid question format: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {e}")


@router.post("/submit")
def submit_quiz(
    req: SubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = len(req.questions)
    score = sum(
        1
        for i, q in enumerate(req.questions)
        if i < len(req.user_answers) and req.user_answers[i] is not None and req.user_answers[i] == q.get("correct")
    )

    record = QuizSession(
        user_id=current_user.id,
        subject=req.subject,
        duration_minutes=req.duration_minutes,
        difficulty=req.difficulty,
        questions=json.dumps(req.questions),
        answers=json.dumps(req.user_answers),
        score=score,
        total=total,
        time_taken=req.time_taken,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "id": record.id,
        "score": score,
        "total": total,
        "percentage": round((score / total) * 100) if total > 0 else 0,
        "time_taken": req.time_taken,
    }


@router.get("/history")
def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    records = (
        db.query(QuizSession)
        .filter(QuizSession.user_id == current_user.id)
        .order_by(QuizSession.created_at.desc())
        .limit(20)
        .all()
    )

    return [
        {
            "id": r.id,
            "subject": r.subject,
            "duration_minutes": r.duration_minutes,
            "difficulty": r.difficulty,
            "score": r.score,
            "total": r.total,
            "percentage": round((r.score / r.total) * 100) if r.total else 0,
            "time_taken": r.time_taken,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]
