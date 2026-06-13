import json
import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession
from groq import Groq

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.learning_data import LearningData
from app.models.subject_performance import SubjectRecord
from app.models.quiz import QuizSession
from app.models.student_profile import StudentProfile
from app.api.routes.auth import get_current_user
from app.api.schemas.career import (
    CareerReadinessResponse,
    ResumeAnalyzeRequest, ResumeAnalyzeResponse, ResumeSection,
    LinkedInAnalyzeRequest, LinkedInAnalyzeResponse,
    InterviewChatRequest, InterviewChatResponse,
    SkillGapResponse, LearningStep,
    CareerRecommendationsResponse, CareerRecommendation,
    JobMatchResponse, JobMatchEntry,
    RoadmapResponse, RoadmapStep,
    CodingChallengeRequest, CodingChallengeResponse, CodingExample,
    CodingEvalRequest, CodingEvalResponse,
)

router = APIRouter(prefix="/career", tags=["career"])
GROQ_MODEL = "llama-3.3-70b-versatile"
_client: Optional[Groq] = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        if not settings.groq_api_key:
            raise HTTPException(status_code=503, detail="AI service not configured. Please set GROQ_API_KEY.")
        _client = Groq(api_key=settings.groq_api_key)
    return _client


def _safe_avg(vals: List[float]) -> float:
    return sum(vals) / len(vals) if vals else 0.0


def _groq_json(prompt: str, max_tokens: int = 1000) -> Optional[dict | list]:
    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=max_tokens,
        )
        text = resp.choices[0].message.content.strip()
        # Extract first JSON object or array
        for start_ch, end_ch in [("{", "}"), ("[", "]")]:
            start = text.find(start_ch)
            end = text.rfind(end_ch) + 1
            if start >= 0 and end > 0:
                return json.loads(text[start:end])
    except Exception:
        pass
    return None


# ── Career keyword map ─────────────────────────────────────────────────────

CAREER_SKILLS: dict[str, list[str]] = {
    "AI Engineer": ["machine learning", "deep learning", "neural network", "tensorflow", "pytorch", "python", "nlp", "computer vision", "transformers"],
    "Data Scientist": ["statistics", "data analysis", "machine learning", "python", "mathematics", "visualization", "sql", "pandas", "numpy"],
    "ML Engineer": ["machine learning", "mlops", "python", "docker", "cloud", "kubernetes", "model deployment", "feature engineering"],
    "Software Developer": ["computer science", "algorithms", "data structures", "programming", "software engineering", "git", "testing"],
    "Research Engineer": ["mathematics", "physics", "research", "machine learning", "algorithms", "optimization", "paper writing"],
    "Data Analyst": ["statistics", "data analysis", "excel", "sql", "visualization", "business intelligence", "tableau", "power bi"],
    "Backend Developer": ["python", "java", "node.js", "api", "database", "sql", "software engineering", "rest", "microservices"],
    "DevOps Engineer": ["docker", "kubernetes", "ci/cd", "cloud", "linux", "networking", "infrastructure", "terraform"],
}

CAREER_REQUIRED_SKILLS: dict[str, list[str]] = {
    "AI Engineer": ["Python", "Machine Learning", "Deep Learning", "TensorFlow/PyTorch", "Mathematics", "MLOps", "Cloud Deployment", "System Design"],
    "Data Scientist": ["Python", "Statistics", "Machine Learning", "SQL", "Data Visualization", "Feature Engineering", "Communication"],
    "ML Engineer": ["Python", "Machine Learning", "MLOps", "Docker", "Cloud Platform", "CI/CD", "System Design"],
    "Software Developer": ["Programming Language", "Data Structures", "Algorithms", "Version Control", "Testing", "Databases"],
    "Research Engineer": ["Mathematics", "Research Methodology", "Machine Learning", "Paper Writing", "Programming", "Problem Solving"],
    "Data Analyst": ["SQL", "Python/R", "Data Visualization", "Statistics", "Excel", "Business Intelligence", "Communication"],
    "Backend Developer": ["Programming Language", "REST APIs", "Databases", "System Design", "Testing", "Microservices"],
    "DevOps Engineer": ["Linux", "Docker", "Kubernetes", "CI/CD", "Cloud Platform", "Networking", "Infrastructure as Code"],
}


def _best_role(subjects: List[str], profile: Optional[StudentProfile]) -> str:
    context = " ".join(subjects).lower()
    if profile:
        context += f" {profile.course} {profile.academic_goals}".lower()
    best_role, best_score = "Software Developer", 0
    for role, keywords in CAREER_SKILLS.items():
        score = sum(1 for kw in keywords if kw in context)
        if score > best_score:
            best_score, best_role = score, role
    return best_role


def _match_score(user_context: str, role: str) -> tuple[int, list[str], list[str]]:
    keywords = CAREER_SKILLS.get(role, [])
    required = CAREER_REQUIRED_SKILLS.get(role, [])
    matched = [kw for kw in keywords if kw in user_context.lower()]
    missing_req = [r for r in required if r.lower() not in user_context.lower()]
    pct = round(len(matched) / len(keywords) * 100) if keywords else 0
    return pct, [m.title() for m in matched], missing_req[:4]


# ── 1. Career Overview ─────────────────────────────────────────────────────

@router.get("/overview", response_model=CareerReadinessResponse)
def get_career_overview(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    profile = db.query(StudentProfile).filter_by(user_id=current_user.id).first()
    entries = db.query(LearningData).filter_by(user_id=current_user.id).order_by(LearningData.date).all()
    records = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()
    quizzes = db.query(QuizSession).filter_by(user_id=current_user.id).filter(QuizSession.score.isnot(None)).all()

    # Academic performance
    subj_scores = [r.score for r in records]
    if subj_scores:
        academic_score = _safe_avg(subj_scores)
    else:
        fallback = []
        for e in entries:
            if e.exam_scores is not None: fallback.append(e.exam_scores)
            if e.quiz_scores is not None: fallback.append(e.quiz_scores)
        academic_score = _safe_avg(fallback) if fallback else 0.0

    # Consistency
    consistency_score = _safe_avg([e.attendance_percentage for e in entries])

    # Quiz performance
    qv: list[float] = []
    for qs in quizzes:
        if qs.total and qs.total > 0:
            qv.append((qs.score / qs.total) * 100)
    for e in entries:
        if e.quiz_scores is not None:
            qv.append(e.quiz_scores)
    quiz_score = _safe_avg(qv)

    # Assignment completion
    assignment_score = _safe_avg([e.assignment_completion_rate for e in entries])

    # Study dedication (6h = 100%)
    study_score = _safe_avg([min(e.study_hours / 6.0, 1.0) * 100 for e in entries])

    # Confidence from subject records (1-5 scale)
    conf_vals = [(r.confidence / 5.0) * 100 for r in records]
    confidence_score = _safe_avg(conf_vals) if conf_vals else 50.0

    # Engagement: unique days in last 7
    today = date.today()
    recent = {e.date for e in entries if (today - e.date).days <= 7}
    engagement_score = min(len(recent) / 5.0, 1.0) * 100

    has_data = bool(entries or records)
    if has_data:
        overall = (
            academic_score * 0.25 +
            consistency_score * 0.20 +
            quiz_score * 0.15 +
            assignment_score * 0.15 +
            study_score * 0.15 +
            confidence_score * 0.05 +
            engagement_score * 0.05
        )
    else:
        overall = 0.0

    overall = int(round(min(max(overall, 0), 100)))
    grade = "A" if overall >= 85 else "B" if overall >= 70 else "C" if overall >= 55 else "D"

    components = {
        "Academic Performance": round(academic_score, 1),
        "Consistency": round(consistency_score, 1),
        "Quiz Performance": round(quiz_score, 1),
        "Assignment Completion": round(assignment_score, 1),
        "Study Dedication": round(study_score, 1),
        "Confidence": round(confidence_score, 1),
        "Engagement": round(engagement_score, 1),
    }
    sorted_comps = sorted(components.items(), key=lambda x: x[1], reverse=True)
    strengths = [k for k, v in sorted_comps if v >= 65][:3]
    improvements = [k for k, v in sorted_comps if v < 65][:3]

    # Twin prediction
    if len(entries) >= 3:
        recent_entries = sorted(entries, key=lambda e: e.date)[-10:]
        trend = recent_entries[-1].study_hours - recent_entries[0].study_hours
        prob = min(95, max(30, overall + int(trend * 3)))
    else:
        prob = max(20, int(overall * 0.8))

    subjects = list({r.subject for r in records})
    if profile and profile.subjects:
        subjects += [s.strip() for s in profile.subjects.split(",") if s.strip()]
    top_role = _best_role(subjects, profile)

    twin_pred = (
        f"Your Digital Twin predicts a {prob}% probability of becoming job-ready for "
        f"{top_role} roles within 6 months, based on your learning trajectory and performance trends."
    )

    return CareerReadinessResponse(
        score=overall,
        grade=grade,
        strengths=strengths if strengths else ["Getting Started"],
        areas_to_improve=improvements if improvements else ["Build more learning data"],
        component_scores=components,
        twin_prediction=twin_pred,
        job_readiness_probability=round(prob / 100, 2),
    )


# ── 2. Resume Analyzer ─────────────────────────────────────────────────────

@router.post("/resume/analyze", response_model=ResumeAnalyzeResponse)
def analyze_resume(
    payload: ResumeAnalyzeRequest,
    current_user: User = Depends(get_current_user),
):
    target = payload.target_role or "software engineering"
    prompt = f"""
You are an expert resume reviewer and ATS specialist. Analyze the following resume for a {target} role.

RESUME:
{payload.resume_text[:4000]}

Respond ONLY with a valid JSON object in this exact structure:
{{
  "score": <overall_score_0_to_100>,
  "ats_score": <ats_compatibility_0_to_100>,
  "strengths": ["strength1", "strength2", "strength3"],
  "suggestions": ["suggestion1", "suggestion2", "suggestion3", "suggestion4", "suggestion5"],
  "missing_keywords": ["keyword1", "keyword2", "keyword3", "keyword4"],
  "sections": [
    {{"name": "Contact Info", "score": <0-100>, "feedback": "..."}},
    {{"name": "Summary/Objective", "score": <0-100>, "feedback": "..."}},
    {{"name": "Experience", "score": <0-100>, "feedback": "..."}},
    {{"name": "Education", "score": <0-100>, "feedback": "..."}},
    {{"name": "Skills", "score": <0-100>, "feedback": "..."}},
    {{"name": "Projects", "score": <0-100>, "feedback": "..."}}
  ]
}}
"""
    data = _groq_json(prompt, max_tokens=1200)
    if not data or not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="AI analysis failed. Please try again.")

    sections = [ResumeSection(**s) for s in data.get("sections", [])]
    return ResumeAnalyzeResponse(
        score=int(data.get("score", 60)),
        ats_score=int(data.get("ats_score", 55)),
        strengths=data.get("strengths", []),
        suggestions=data.get("suggestions", []),
        missing_keywords=data.get("missing_keywords", []),
        sections=sections,
    )


# ── 3. LinkedIn Optimizer ──────────────────────────────────────────────────

@router.post("/linkedin/analyze", response_model=LinkedInAnalyzeResponse)
def analyze_linkedin(
    payload: LinkedInAnalyzeRequest,
    current_user: User = Depends(get_current_user),
):
    target = payload.target_role or "software engineering"
    prompt = f"""
You are a LinkedIn optimization expert. Analyze this LinkedIn profile for a {target} role.

PROFILE:
{payload.profile_text[:4000]}

Respond ONLY with valid JSON:
{{
  "score": <overall_0_to_100>,
  "suggestions": ["s1", "s2", "s3", "s4"],
  "optimized_headline": "<compelling_headline_under_220_chars>",
  "optimized_summary": "<optimized_about_section_3_to_4_sentences>",
  "missing_skills": ["skill1", "skill2", "skill3"],
  "section_scores": {{
    "Headline": <0-100>,
    "About": <0-100>,
    "Experience": <0-100>,
    "Skills": <0-100>,
    "Education": <0-100>
  }}
}}
"""
    data = _groq_json(prompt, max_tokens=1000)
    if not data or not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="AI analysis failed. Please try again.")

    return LinkedInAnalyzeResponse(
        score=int(data.get("score", 60)),
        suggestions=data.get("suggestions", []),
        optimized_headline=data.get("optimized_headline", ""),
        optimized_summary=data.get("optimized_summary", ""),
        missing_skills=data.get("missing_skills", []),
        section_scores=data.get("section_scores", {}),
    )


# ── 4. Mock Interview ──────────────────────────────────────────────────────

@router.post("/interview/chat", response_model=InterviewChatResponse)
def interview_chat(
    payload: InterviewChatRequest,
    current_user: User = Depends(get_current_user),
):
    client = _get_client()
    total_q = 8
    user_messages = [m for m in payload.history if m.role == "user"]
    q_num = len(user_messages) + 1

    if payload.mode == "evaluate" or q_num > total_q:
        # Evaluate the full interview
        convo = "\n".join(f"{m.role.upper()}: {m.content}" for m in payload.history)
        eval_prompt = f"""
You are an expert technical interviewer evaluating a mock interview for a {payload.role} position.

INTERVIEW TRANSCRIPT:
{convo[:3000]}

Score the candidate (0-100) on each dimension and provide feedback.
Respond ONLY with valid JSON:
{{
  "interview_score": <0-100>,
  "communication_score": <0-100>,
  "confidence_score": <0-100>,
  "technical_score": <0-100>,
  "feedback": "<2-3 sentence overall assessment>",
  "strengths": ["s1", "s2"],
  "improvements": ["i1", "i2"]
}}
"""
        data = _groq_json(eval_prompt, max_tokens=600)
        if not data:
            data = {"interview_score": 65, "communication_score": 70, "confidence_score": 65, "technical_score": 60, "feedback": "Good effort overall.", "strengths": [], "improvements": []}

        return InterviewChatResponse(
            message=f"Interview complete! Overall score: {data.get('interview_score', 65)}/100.\n\n{data.get('feedback', '')}",
            is_complete=True,
            scores={
                "interview": int(data.get("interview_score", 65)),
                "communication": int(data.get("communication_score", 70)),
                "confidence": int(data.get("confidence_score", 65)),
                "technical": int(data.get("technical_score", 60)),
            },
            feedback=f"Strengths: {', '.join(data.get('strengths', []))}. Improvements: {', '.join(data.get('improvements', []))}.",
        )

    # Generate next question
    history_msgs = [{"role": m.role, "content": m.content} for m in payload.history]
    sys_prompt = f"""You are a professional interviewer conducting a mock interview for a {payload.role} position.
Ask {total_q} questions total mixing technical, behavioral, and HR questions.
This is question {q_num} of {total_q}. Ask ONE clear, relevant interview question.
Do NOT include numbering. Do NOT give feedback yet. Just ask the question."""

    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "system", "content": sys_prompt}] + history_msgs,
        temperature=0.6,
        max_tokens=200,
    )
    question = resp.choices[0].message.content.strip()

    return InterviewChatResponse(
        message=question,
        question_number=q_num,
        total_questions=total_q,
        is_complete=False,
    )


# ── 6. Skill Gap Analysis ──────────────────────────────────────────────────

@router.get("/skill-gap", response_model=SkillGapResponse)
def get_skill_gap(
    target: str = Query("AI Engineer"),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    profile = db.query(StudentProfile).filter_by(user_id=current_user.id).first()
    records = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()

    user_subjects: set[str] = set()
    if profile and profile.subjects:
        for s in profile.subjects.split(","):
            if s.strip():
                user_subjects.add(s.strip())
    for r in records:
        user_subjects.add(r.subject)

    context = " ".join(user_subjects).lower()
    if profile:
        context += f" {profile.course} {profile.academic_goals}".lower()

    required = CAREER_REQUIRED_SKILLS.get(target, CAREER_REQUIRED_SKILLS["Software Developer"])
    missing = [r for r in required if r.lower() not in context]
    current = [r for r in required if r.lower() in context]

    # AI-generated learning plan
    prompt = f"""
User wants to become a {target}.
Current skills: {', '.join(user_subjects) if user_subjects else 'None yet'}
Missing skills needed: {', '.join(missing)}

Create a 4-step learning roadmap to fill skill gaps. Be specific and actionable.
Respond ONLY with valid JSON array:
[
  {{"step": 1, "title": "...", "description": "...", "resources": ["r1", "r2"], "duration": "..."}},
  {{"step": 2, "title": "...", "description": "...", "resources": ["r1", "r2"], "duration": "..."}},
  {{"step": 3, "title": "...", "description": "...", "resources": ["r1", "r2"], "duration": "..."}},
  {{"step": 4, "title": "...", "description": "...", "resources": ["r1", "r2"], "duration": "..."}}
]
"""
    plan_data = _groq_json(prompt, max_tokens=800)
    if isinstance(plan_data, list):
        plan = [LearningStep(**s) for s in plan_data if isinstance(s, dict)]
    else:
        plan = [LearningStep(step=1, title="Start Learning", description=f"Begin studying {missing[0] if missing else 'core skills'}.", resources=["Coursera", "YouTube"], duration="2 weeks")]

    compat = round(len(current) / len(required) * 100) if required else 0

    return SkillGapResponse(
        target_career=target,
        current_skills=list(user_subjects) if user_subjects else ["No data yet — add subjects in your profile"],
        missing_skills=missing,
        learning_plan=plan,
        compatibility_score=compat,
    )


# ── 7. Career Recommendations ─────────────────────────────────────────────

@router.get("/recommendations", response_model=CareerRecommendationsResponse)
def get_career_recommendations(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    profile = db.query(StudentProfile).filter_by(user_id=current_user.id).first()
    records = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()
    entries = db.query(LearningData).filter_by(user_id=current_user.id).all()

    user_subjects: set[str] = set()
    if profile and profile.subjects:
        for s in profile.subjects.split(","):
            if s.strip(): user_subjects.add(s.strip())
    for r in records: user_subjects.add(r.subject)

    context = " ".join(user_subjects).lower()
    if profile:
        context += f" {profile.course} {profile.academic_goals}".lower()

    avg_score = _safe_avg([r.score for r in records]) if records else 50.0
    avg_study = _safe_avg([e.study_hours for e in entries]) if entries else 0.0

    recs: list[CareerRecommendation] = []
    for role, required in CAREER_REQUIRED_SKILLS.items():
        pct, matched, missing = _match_score(context, role)
        # Boost score based on academic performance
        boosted = min(100, int(pct * 0.6 + avg_score * 0.3 + min(avg_study / 6, 1) * 10))
        reasoning = f"Based on your subjects and learning pattern, {role} aligns well." if boosted >= 50 else f"You have foundational skills but need more focus for {role}."
        recs.append(CareerRecommendation(
            role=role,
            compatibility=boosted,
            reasoning=reasoning,
            required_skills=required[:5],
            key_matches=matched[:4],
        ))

    recs.sort(key=lambda r: r.compatibility, reverse=True)
    top = recs[0].role if recs else "Software Developer"

    # AI-generated twin insight
    prompt = f"""
Student profile: {profile.course if profile else 'General'}, studying {', '.join(list(user_subjects)[:5]) if user_subjects else 'various subjects'}.
Average score: {avg_score:.0f}%, daily study: {avg_study:.1f}h.
Top career match: {top}.

Write a single compelling sentence (max 30 words) from the Digital Twin perspective predicting their career path. Be specific and motivating.
"""
    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=80,
        )
        twin_insight = resp.choices[0].message.content.strip().strip('"')
    except Exception:
        twin_insight = f"Your learning trajectory strongly points toward a {top} career path."

    return CareerRecommendationsResponse(
        recommendations=recs[:6],
        top_match=top,
        twin_insight=twin_insight,
    )


# ── 8. Job Role Matching ───────────────────────────────────────────────────

@router.get("/job-matching", response_model=JobMatchResponse)
def get_job_matching(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    profile = db.query(StudentProfile).filter_by(user_id=current_user.id).first()
    records = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()
    entries = db.query(LearningData).filter_by(user_id=current_user.id).all()

    user_subjects: set[str] = set()
    if profile and profile.subjects:
        for s in profile.subjects.split(","):
            if s.strip(): user_subjects.add(s.strip())
    for r in records: user_subjects.add(r.subject)

    context = " ".join(user_subjects).lower()
    if profile:
        context += f" {profile.course} {profile.academic_goals}".lower()

    avg_score = _safe_avg([r.score for r in records]) if records else 50.0

    matches: list[JobMatchEntry] = []
    for role in CAREER_REQUIRED_SKILLS:
        pct, matched, missing = _match_score(context, role)
        final = min(99, int(pct * 0.65 + avg_score * 0.25 + 10))
        if matched:
            reasoning = f"Strong match in {', '.join(matched[:2])}."
        else:
            reasoning = "Build more relevant skills to improve match."
        matches.append(JobMatchEntry(
            role=role,
            match_percent=final,
            reasoning=reasoning,
            key_skills_matched=matched[:4],
            missing_skills=missing[:3],
        ))

    matches.sort(key=lambda m: m.match_percent, reverse=True)
    return JobMatchResponse(matches=matches, top_role=matches[0].role if matches else "Software Developer")


# ── 9. Career Roadmap ─────────────────────────────────────────────────────

@router.get("/roadmap", response_model=RoadmapResponse)
def get_career_roadmap(
    target: str = Query("AI Engineer"),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    profile = db.query(StudentProfile).filter_by(user_id=current_user.id).first()
    records = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()
    entries = db.query(LearningData).filter_by(user_id=current_user.id).all()

    current_pos = profile.course if profile else "Student"
    user_subjects = list({r.subject for r in records})
    avg_score = _safe_avg([r.score for r in records]) if records else 50.0

    prompt = f"""
Create a personalized career roadmap for a student who wants to become a {target}.
Current position: {current_pos}
Known subjects: {', '.join(user_subjects[:6]) if user_subjects else 'General studies'}
Current performance: {avg_score:.0f}%

Generate a 6-step roadmap. Respond ONLY with valid JSON:
{{
  "estimated_time": "<total time e.g. '8-12 months'>",
  "steps": [
    {{
      "step": 1,
      "title": "<milestone title>",
      "description": "<what to do in 1-2 sentences>",
      "duration": "<e.g. '3 weeks'>",
      "resources": ["resource1", "resource2"],
      "status": "current"
    }},
    ... (6 steps total, first is "current", rest are "pending")
  ]
}}
"""
    data = _groq_json(prompt, max_tokens=1200)
    if isinstance(data, dict) and "steps" in data:
        steps = [RoadmapStep(**s) for s in data["steps"] if isinstance(s, dict)]
        estimated = data.get("estimated_time", "6-12 months")
    else:
        steps = [
            RoadmapStep(step=1, title="Build Foundations", description="Master core fundamentals.", duration="1 month", resources=["Coursera", "Khan Academy"], status="current"),
            RoadmapStep(step=2, title="Learn Key Tools", description="Study essential tools for the role.", duration="2 months", resources=["YouTube", "Documentation"], status="pending"),
            RoadmapStep(step=3, title="Build Projects", description="Create portfolio projects.", duration="2 months", resources=["GitHub", "Kaggle"], status="pending"),
            RoadmapStep(step=4, title="Interview Prep", description="Practice coding and behavioral questions.", duration="1 month", resources=["LeetCode", "Pramp"], status="pending"),
        ]
        estimated = "6-8 months"

    # Success probability from overview logic
    overall = int(round(min(max(avg_score * 0.6 + 20, 0), 100)))
    prob = min(0.95, max(0.3, overall / 100 + 0.05))

    return RoadmapResponse(
        current_position=current_pos,
        target_career=target,
        steps=steps,
        estimated_time=estimated,
        twin_success_probability=round(prob, 2),
    )


# ── 5. Coding Challenge ────────────────────────────────────────────────────

@router.post("/coding/challenge", response_model=CodingChallengeResponse)
def get_coding_challenge(
    payload: CodingChallengeRequest,
    current_user: User = Depends(get_current_user),
):
    prompt = f"""
Generate a {payload.difficulty} difficulty coding problem on the topic of {payload.topic}.

Respond ONLY with valid JSON:
{{
  "title": "<problem title>",
  "problem": "<full problem description>",
  "examples": [
    {{"input": "...", "output": "...", "explanation": "..."}},
    {{"input": "...", "output": "...", "explanation": "..."}}
  ],
  "hints": ["hint1", "hint2", "hint3"],
  "constraints": ["constraint1", "constraint2"]
}}
"""
    data = _groq_json(prompt, max_tokens=900)
    if not data or not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="Failed to generate challenge.")

    examples = [CodingExample(**e) for e in data.get("examples", [])]
    return CodingChallengeResponse(
        title=data.get("title", "Coding Challenge"),
        problem=data.get("problem", ""),
        examples=examples,
        hints=data.get("hints", []),
        difficulty=payload.difficulty,
        topic=payload.topic,
        constraints=data.get("constraints", []),
    )


@router.post("/coding/evaluate", response_model=CodingEvalResponse)
def evaluate_coding_solution(
    payload: CodingEvalRequest,
    current_user: User = Depends(get_current_user),
):
    prompt = f"""
Evaluate this {payload.language} solution for the following coding problem.

PROBLEM:
{payload.problem[:1000]}

SOLUTION:
{payload.solution[:2000]}

Respond ONLY with valid JSON:
{{
  "score": <0-100>,
  "is_correct": <true|false>,
  "feedback": "<2-3 sentence assessment>",
  "time_complexity": "<e.g. O(n log n)>",
  "space_complexity": "<e.g. O(n)>",
  "improvements": ["improvement1", "improvement2", "improvement3"]
}}
"""
    data = _groq_json(prompt, max_tokens=600)
    if not data or not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="Evaluation failed.")

    return CodingEvalResponse(
        score=int(data.get("score", 60)),
        is_correct=bool(data.get("is_correct", False)),
        feedback=data.get("feedback", ""),
        time_complexity=data.get("time_complexity", "Unknown"),
        space_complexity=data.get("space_complexity", "Unknown"),
        improvements=data.get("improvements", []),
    )
