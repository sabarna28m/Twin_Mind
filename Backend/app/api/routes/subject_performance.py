import json
from datetime import date as DateType
from statistics import mean
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.models.subject_performance import SubjectRecord
from app.models.quiz import QuizSession
from app.models.session import Session as StudySession
from app.models.student_profile import StudentProfile
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.api.schemas.subject_performance import (
    SubjectRecordCreate, SubjectRecordResponse, SubjectSummary,
    SubjectAnalysisResponse, TopicSummary, ScorePoint,
    ActionPlanDay, PriorityItem,
)

router = APIRouter(prefix="/subject-performance", tags=["subject-performance"])

# Lookup helpers for well-known subjects — used only when the user has
# actual data for these subjects.  They are NOT defaults that appear for
# every user.
SUBJECT_TOPICS: dict[str, list[str]] = {
    "Mathematics":      ["Algebra", "Calculus", "Statistics", "Geometry", "Trigonometry"],
    "Physics":          ["Mechanics", "Optics", "Thermodynamics", "Electromagnetism", "Modern Physics"],
    "Chemistry":        ["Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Analytical Chemistry"],
    "Biology":          ["Botany", "Zoology", "Genetics", "Ecology", "Physiology"],
    "English":          ["Grammar", "Literature", "Writing", "Comprehension", "Vocabulary"],
    "Computer Science": ["Algorithms", "Data Structures", "Programming", "Databases", "Networks"],
    "Machine Learning": ["Supervised Learning", "Unsupervised Learning", "Neural Networks", "Model Evaluation"],
    "Computer Networks": ["OSI Model", "TCP/IP", "Routing", "Security", "Wireless Networks"],
    "DBMS":             ["Relational Model", "SQL", "Normalization", "Transactions", "Indexing"],
    "Operating Systems": ["Processes", "Memory Management", "File Systems", "Scheduling", "Deadlocks"],
    "Data Structures":  ["Arrays", "Linked Lists", "Trees", "Graphs", "Hashing"],
    "Algorithms":       ["Sorting", "Searching", "Dynamic Programming", "Greedy", "Graph Algorithms"],
    "Software Engineering": ["SDLC", "Design Patterns", "Testing", "Agile", "Version Control"],
}

SUBJECT_SPECIFIC_ADVICE: dict[str, str] = {
    "Physics":           "Derive formulas from first principles and solve 5 numerical problems daily.",
    "Chemistry":         "Use flashcards for organic reaction mechanisms; attempt chapter-end problems weekly.",
    "Mathematics":       "Practice problem sets every day — consistency beats marathon sessions.",
    "Biology":           "Draw diagrams and flowcharts for processes like cell division and photosynthesis.",
    "English":           "Read one article per day; identify grammar patterns and practice writing summaries.",
    "Computer Science":  "Code daily, even 30 minutes. Work through algorithm challenges on LeetCode/HackerRank.",
    "Machine Learning":  "Implement algorithms from scratch before using libraries — understanding beats memorisation.",
    "Computer Networks": "Build small packet-tracer labs; trace packets through every OSI layer as you study.",
    "DBMS":              "Write SQL queries for every concept you learn; test on a real database (SQLite is fine).",
    "Operating Systems": "Trace through OS algorithms on paper; implement a simple scheduler or memory allocator.",
    "Data Structures":   "Visualise every operation with diagrams; code each structure from scratch at least once.",
    "Algorithms":        "Solve 3 LeetCode/Codeforces problems per day, focusing on your weakest pattern first.",
}


# ── Pure helpers ───────────────────────────────────────────────────────

def _risk(score: float) -> str:
    return "strong" if score >= 75 else ("average" if score >= 50 else "weak")


def _trend(scores: list[float]) -> str:
    if len(scores) < 2:
        return "stable"
    delta = scores[-1] - scores[0]
    return "improving" if delta > 3 else ("declining" if delta < -3 else "stable")


def _rec_minutes(score: float) -> int:
    if score < 50: return 90
    if score < 65: return 60
    if score < 75: return 45
    return 30


def _subject_match(stored: str, canonical: str) -> bool:
    a, b = stored.lower().strip(), canonical.lower().strip()
    return a == b or b in a or a in b


def _build_summary(
    subject: str,
    records: list,
    quizzes: list,
    sessions: list,
    today: DateType,
) -> SubjectSummary:
    pts: list[ScorePoint] = []
    for r in records:
        pts.append(ScorePoint(date=r.date, score=r.score, source=r.source))
    for q in quizzes:
        if q.score is not None and q.total and q.total > 0:
            pts.append(ScorePoint(
                date=q.created_at.date() if q.created_at else today,
                score=round((q.score / q.total) * 100, 1),
                source="quiz",
            ))
    pts.sort(key=lambda p: p.date)

    scores = [p.score for p in pts]
    avg   = round(mean(scores), 1) if scores else 0.0
    latest = scores[-1] if scores else 0.0
    prev   = scores[-2] if len(scores) >= 2 else None
    imp    = round(latest - prev, 1) if prev is not None else None

    rec_h = sum(r.study_hours for r in records)
    ses_h = sum((s.duration_minutes or 0) for s in sessions) / 60
    study_h = round(rec_h + ses_h, 1)

    cfds = [r.confidence for r in records if r.confidence]
    conf = round(mean(cfds), 1) if cfds else 3.0

    all_dates = (
        [r.date for r in records]
        + [q.created_at.date() for q in quizzes if q.created_at]
        + [s.created_at.date() for s in sessions if s.created_at]
    )
    last_act = max(all_dates) if all_dates else None
    days_since = (today - last_act).days if last_act else None

    # Aggregate topics from SubjectRecord.topics_json
    topic_map: dict[str, list[float]] = {}
    for r in records:
        try:
            for t in json.loads(r.topics_json or "[]"):
                n, s = t.get("name", ""), t.get("score")
                if n and s is not None:
                    topic_map.setdefault(n, []).append(float(s))
        except Exception:
            pass

    if topic_map:
        topics = [
            TopicSummary(name=n, score=round(mean(ss), 1), risk=_risk(mean(ss)))
            for n, ss in topic_map.items()
        ]
    else:
        # Default topics (all unscored = 0 = weak) only if subject is default
        topics = (
            [TopicSummary(name=t, score=0.0, risk="weak") for t in SUBJECT_TOPICS[subject]]
            if subject in SUBJECT_TOPICS else []
        )

    return SubjectSummary(
        subject=subject,
        avg_score=avg,
        latest_score=latest,
        previous_score=prev,
        improvement=imp,
        study_hours=study_h,
        confidence=conf,
        last_activity=last_act,
        days_since_activity=days_since,
        trend=_trend(scores[-5:]),
        risk_level=_risk(avg),
        topics=topics,
        score_history=pts[-30:],
        recommended_daily_minutes=_rec_minutes(avg),
    )


def _recommendations(s: SubjectSummary) -> list[str]:
    recs: list[str] = []
    weak_t = [t.name for t in s.topics if t.risk == "weak"]
    avg_t  = [t.name for t in s.topics if t.risk == "average"]

    if s.avg_score < 50:
        if weak_t:
            recs.append(f"Critical gaps: {', '.join(weak_t[:2])}. Study these before anything else.")
        else:
            recs.append(f"Overall {s.subject} fundamentals need rebuilding. Start with Chapter 1 basics.")
        recs.append("Aim for 3 practice tests per week to build exam readiness.")
    elif s.avg_score < 75:
        if avg_t:
            recs.append(f"Push {', '.join(avg_t[:2])} into the strong zone with focused daily drills.")
        recs.append("Two focused revision sessions weekly will move you from average to strong.")
    else:
        recs.append("Strong performance — one weekly revision session keeps you at the top.")

    if s.study_hours < 2:
        recs.append(f"Study time is very low ({s.study_hours:.1f}h). Target at least 1.5h/day.")
    if s.days_since_activity and s.days_since_activity >= 3:
        recs.append(f"No activity for {s.days_since_activity} days — resume today to avoid skill decay.")
    if s.trend == "declining":
        recs.append("Scores are trending down. Identify which topics to tackle first from the topic view.")
    elif s.trend == "improving":
        recs.append("Great upward trend! Maintain momentum with consistent daily sessions.")
    if s.subject in SUBJECT_SPECIFIC_ADVICE:
        recs.append(SUBJECT_SPECIFIC_ADVICE[s.subject])

    return recs[:4]


def _action_plan(subject: str, weak_topics: list[str]) -> list[dict]:
    t1 = weak_topics[0] if weak_topics else "core concepts"
    t2 = weak_topics[1] if len(weak_topics) > 1 else "problem sets"
    days = [
        ActionPlanDay(day=1, title="Foundation Review",  task=f"Re-read fundamentals of {t1} — notes + textbook"),
        ActionPlanDay(day=2, title="Deep Practice",      task=f"Solve 20 targeted problems on {t1}, check all solutions"),
        ActionPlanDay(day=3, title="Expand Scope",       task=f"Study {t2} and create concept-map diagrams"),
        ActionPlanDay(day=4, title="Mini Assessment",    task=f"15-question quiz on {subject} — flag every mistake"),
        ActionPlanDay(day=5, title="Mistake Analysis",   task="Review each incorrect answer; close the concept gap"),
        ActionPlanDay(day=6, title="Mixed Practice",     task=f"Mixed set: {t1} + {t2} combined problems"),
        ActionPlanDay(day=7, title="Mock Test",          task=f"Full {subject} mock test + score analysis + set next targets"),
    ]
    return [d.model_dump() for d in days]


# ── Routes ─────────────────────────────────────────────────────────────

@router.post("/record", response_model=SubjectRecordResponse, status_code=status.HTTP_201_CREATED)
def add_record(
    payload: SubjectRecordCreate,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    rec = SubjectRecord(
        user_id=current_user.id,
        subject=payload.subject,
        date=payload.date,
        score=payload.score,
        study_hours=payload.study_hours,
        confidence=payload.confidence,
        source=payload.source,
        topics_json=json.dumps([t.model_dump() for t in payload.topics]),
        notes=payload.notes,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    out = SubjectRecordResponse.model_validate(rec)
    try:
        out.topics = [
            TopicSummary(name=t["name"], score=t["score"], risk=_risk(t["score"]))
            for t in json.loads(rec.topics_json or "[]")
        ]
    except Exception:
        pass
    return out


@router.get("/analysis", response_model=SubjectAnalysisResponse)
def get_analysis(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    today = DateType.today()

    all_records = db.query(SubjectRecord).filter(SubjectRecord.user_id == current_user.id).all()
    all_quizzes = db.query(QuizSession).filter(QuizSession.user_id == current_user.id).all()
    all_sessions = db.query(StudySession).filter(
        StudySession.user_id == current_user.id,
        StudySession.status == "completed",
    ).all()

    custom_subjects = (
        {r.subject for r in all_records}
        | {q.subject for q in all_quizzes if q.subject}
        | {s.subject for s in all_sessions if s.subject}
    ) - set(DEFAULT_SUBJECTS)

    all_names = DEFAULT_SUBJECTS + sorted(custom_subjects)

    summaries: list[SubjectSummary] = []
    for subj in all_names:
        s_recs = [r for r in all_records if r.subject == subj]
        s_quiz = [q for q in all_quizzes if q.subject and _subject_match(q.subject, subj)]
        s_ses  = [s for s in all_sessions if s.subject and _subject_match(s.subject, subj)]
        summaries.append(_build_summary(subj, s_recs, s_quiz, s_ses, today))

    with_data = [s for s in summaries if s.score_history]
    no_data   = [s for s in summaries if not s.score_history]

    weakest      = min(with_data, key=lambda s: s.avg_score)      if with_data else None
    strongest    = max(with_data, key=lambda s: s.avg_score)      if with_data else None
    most_improved = (
        max([s for s in with_data if s.improvement is not None], key=lambda s: s.improvement or 0, default=None)
    )
    neglected = (
        max([s for s in with_data if s.days_since_activity is not None],
            key=lambda s: s.days_since_activity or 0, default=None)
    ) if with_data else None

    recs_map: dict[str, list[str]] = {}
    plan_map: dict[str, list[dict]] = {}
    for s in with_data:
        recs_map[s.subject] = _recommendations(s)
        if s.risk_level in ("weak", "average"):
            plan_map[s.subject] = _action_plan(s.subject, [t.name for t in s.topics if t.risk == "weak"])

    # Notifications
    notifs: list[str] = []
    for s in with_data:
        if s.trend == "declining" and s.improvement is not None and abs(s.improvement) >= 5:
            notifs.append(f"📉 {s.subject} score dropped by {abs(s.improvement):.0f}% — review needed.")
        if s.days_since_activity and s.days_since_activity >= 5:
            notifs.append(f"⏰ {s.subject} has not been studied for {s.days_since_activity} days.")
        if s.avg_score < 45:
            notifs.append(f"🔔 AI recommends focusing on {s.subject} today (score: {s.avg_score:.0f}%).")

    # Priority ranking (higher score = lower rank number = less urgent, but we rank by urgency)
    def _urgency(s: SubjectSummary) -> float:
        base = 100 - (s.avg_score if s.score_history else 50)
        if s.trend == "declining":  base += 15
        if s.trend == "improving":  base -= 10
        if s.days_since_activity:   base += min(s.days_since_activity * 2, 20)
        return base

    ranked = sorted(with_data + no_data, key=_urgency, reverse=True)
    priority_ranking = [
        PriorityItem(
            rank=i + 1,
            subject=s.subject,
            avg_score=s.avg_score,
            risk_level=s.risk_level,
            priority_label=(
                "No Data" if not s.score_history else
                "Critical Attention Required" if s.avg_score < 50 else
                "Needs Improvement" if s.avg_score < 65 else
                "Good" if s.avg_score < 75 else "Strong"
            ),
        )
        for i, s in enumerate(ranked)
    ]

    return SubjectAnalysisResponse(
        subjects=with_data + no_data,
        weakest=weakest,
        strongest=strongest,
        most_improved=most_improved,
        neglected=neglected,
        focus_today=weakest,
        recommendations=recs_map,
        action_plans=plan_map,
        notifications=notifs[:6],
        priority_ranking=priority_ranking,
    )


@router.get("/records", response_model=List[SubjectRecordResponse])
def list_records(
    subject: Optional[str] = None,
    limit: int = Query(default=60, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    q = db.query(SubjectRecord).filter(SubjectRecord.user_id == current_user.id)
    if subject:
        q = q.filter(SubjectRecord.subject == subject)
    return q.order_by(SubjectRecord.date.desc()).limit(limit).all()


@router.put("/record/{record_id}", response_model=SubjectRecordResponse)
def update_record(
    record_id: int,
    payload: SubjectRecordCreate,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    rec = db.query(SubjectRecord).filter(
        SubjectRecord.id == record_id,
        SubjectRecord.user_id == current_user.id,
    ).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    rec.subject     = payload.subject
    rec.date        = payload.date
    rec.score       = payload.score
    rec.study_hours = payload.study_hours
    rec.confidence  = payload.confidence
    rec.source      = payload.source
    rec.topics_json = json.dumps([t.model_dump() for t in payload.topics])
    rec.notes       = payload.notes

    db.commit()
    db.refresh(rec)
    out = SubjectRecordResponse.model_validate(rec)
    try:
        out.topics = [
            TopicSummary(name=t["name"], score=t["score"], risk=_risk(t["score"]))
            for t in json.loads(rec.topics_json or "[]")
        ]
    except Exception:
        pass
    return out


@router.delete("/record/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    rec = db.query(SubjectRecord).filter(
        SubjectRecord.id == record_id,
        SubjectRecord.user_id == current_user.id,
    ).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    db.delete(rec)
    db.commit()
