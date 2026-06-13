import io
import json
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session as DBSession
from groq import Groq

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.learning_data import LearningData
from app.models.subject_performance import SubjectRecord
from app.models.quiz import QuizSession
from app.models.student_profile import StudentProfile
from app.models.career_twin import CareerTwin
from app.api.routes.auth import get_current_user
from app.api.schemas.career import (
    CareerReadinessResponse,
    ResumeAnalyzeRequest, ResumeAnalyzeResponse, ResumeSection, BulletImprovement,
    LinkedInAnalyzeRequest, LinkedInAnalyzeResponse,
    InterviewChatRequest, InterviewChatResponse,
    SkillGapResponse, LearningStep,
    CareerRecommendationsResponse, CareerRecommendation,
    JobMatchResponse, JobMatchEntry,
    RoadmapResponse, RoadmapStep,
    CodingChallengeRequest, CodingChallengeResponse, CodingExample,
    CodingEvalRequest, CodingEvalResponse,
    CareerTwinResponse, CareerTwinPrediction,
    AnalyticsResponse,
)

router = APIRouter(prefix="/career", tags=["career"])
GROQ_MODEL = "llama-3.3-70b-versatile"
_client: Optional[Groq] = None

MAX_UPLOAD_MB = 5


# ── AI client ──────────────────────────────────────────────────────────────

def _get_client() -> Groq:
    global _client
    if _client is None:
        if not settings.groq_api_key:
            raise HTTPException(status_code=503, detail="AI service not configured.")
        _client = Groq(api_key=settings.groq_api_key)
    return _client


def _safe_avg(vals: List[float]) -> float:
    return sum(vals) / len(vals) if vals else 0.0


def _groq_json(prompt: str, max_tokens: int = 1200) -> Optional[dict | list]:
    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=max_tokens,
        )
        text = resp.choices[0].message.content.strip()
        for start_ch, end_ch in [("{", "}"), ("[", "]")]:
            s = text.find(start_ch)
            e = text.rfind(end_ch) + 1
            if s >= 0 and e > 0:
                return json.loads(text[s:e])
    except Exception:
        pass
    return None


# ── File text extractors ───────────────────────────────────────────────────

def _extract_pdf(content: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        parts = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                parts.append(t)
        return "\n".join(parts)
    except Exception as ex:
        raise HTTPException(status_code=422, detail=f"PDF extraction failed: {ex}")


def _extract_docx(content: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception as ex:
        raise HTTPException(status_code=422, detail=f"DOCX extraction failed: {ex}")


# ── Career Twin DB helpers ─────────────────────────────────────────────────

def _get_or_create_twin(user_id: int, db: DBSession) -> CareerTwin:
    twin = db.query(CareerTwin).filter_by(user_id=user_id).first()
    if not twin:
        twin = CareerTwin(user_id=user_id)
        db.add(twin)
        db.commit()
        db.refresh(twin)
    return twin


def _update_twin(
    user_id: int,
    db: DBSession,
    *,
    resume_score: Optional[float] = None,
    linkedin_score: Optional[float] = None,
    interview_score: Optional[float] = None,
    coding_score: Optional[float] = None,
    skills: Optional[List[str]] = None,
    certifications: Optional[List[str]] = None,
    resume_text: Optional[str] = None,
    event: str = "update",
) -> CareerTwin:
    twin = _get_or_create_twin(user_id, db)

    if resume_score is not None:
        twin.resume_score = resume_score
    if linkedin_score is not None:
        twin.linkedin_score = linkedin_score
    if interview_score is not None:
        twin.interview_score = interview_score
    if coding_score is not None:
        twin.coding_score = coding_score
    if skills is not None:
        existing = set(json.loads(twin.skills_json or "[]"))
        existing.update(skills)
        twin.skills_json = json.dumps(sorted(existing))
    if certifications is not None:
        existing = set(json.loads(twin.certifications_json or "[]"))
        existing.update(certifications)
        twin.certifications_json = json.dumps(sorted(existing))
    if resume_text is not None:
        twin.last_resume_text = resume_text

    # Recompute employability
    scores = [s for s in [twin.resume_score, twin.linkedin_score, twin.interview_score, twin.coding_score] if s > 0]
    if scores:
        weights = [0.30, 0.20, 0.25, 0.25]
        all_scores = [twin.resume_score, twin.linkedin_score, twin.interview_score, twin.coding_score]
        twin.employability_score = round(
            all_scores[0] * 0.30 + all_scores[1] * 0.20 + all_scores[2] * 0.25 + all_scores[3] * 0.25, 1
        )

    # Append to history
    history = json.loads(twin.score_history_json or "[]")
    history.append({
        "date": date.today().isoformat(),
        "event": event,
        "resume": round(twin.resume_score, 1),
        "linkedin": round(twin.linkedin_score, 1),
        "interview": round(twin.interview_score, 1),
        "coding": round(twin.coding_score, 1),
        "employability": round(twin.employability_score, 1),
    })
    twin.score_history_json = json.dumps(history[-60:])  # keep last 60 snapshots

    db.commit()
    db.refresh(twin)
    return twin


# ── Career keyword / role maps ─────────────────────────────────────────────

CAREER_SKILLS: dict[str, list[str]] = {
    "AI Engineer":       ["machine learning", "deep learning", "neural network", "tensorflow", "pytorch", "python", "nlp", "computer vision", "transformers"],
    "Data Scientist":    ["statistics", "data analysis", "machine learning", "python", "mathematics", "visualization", "sql", "pandas", "numpy"],
    "ML Engineer":       ["machine learning", "mlops", "python", "docker", "cloud", "kubernetes", "model deployment", "feature engineering"],
    "Software Developer":["computer science", "algorithms", "data structures", "programming", "software engineering", "git", "testing"],
    "Research Engineer": ["mathematics", "physics", "research", "machine learning", "algorithms", "optimization"],
    "Data Analyst":      ["statistics", "data analysis", "excel", "sql", "visualization", "business intelligence", "tableau"],
    "Backend Developer": ["python", "java", "node.js", "api", "database", "sql", "rest", "microservices"],
    "DevOps Engineer":   ["docker", "kubernetes", "ci/cd", "cloud", "linux", "networking", "terraform"],
}

CAREER_REQUIRED_SKILLS: dict[str, list[str]] = {
    "AI Engineer":        ["Python", "Machine Learning", "Deep Learning", "TensorFlow/PyTorch", "Mathematics", "MLOps", "Cloud Deployment", "System Design"],
    "Data Scientist":     ["Python", "Statistics", "Machine Learning", "SQL", "Data Visualization", "Feature Engineering", "Communication"],
    "ML Engineer":        ["Python", "Machine Learning", "MLOps", "Docker", "Cloud Platform", "CI/CD", "System Design"],
    "Software Developer": ["Programming Language", "Data Structures", "Algorithms", "Version Control", "Testing", "Databases"],
    "Research Engineer":  ["Mathematics", "Research Methodology", "Machine Learning", "Paper Writing", "Programming", "Problem Solving"],
    "Data Analyst":       ["SQL", "Python/R", "Data Visualization", "Statistics", "Excel", "Business Intelligence", "Communication"],
    "Backend Developer":  ["Programming Language", "REST APIs", "Databases", "System Design", "Testing", "Microservices"],
    "DevOps Engineer":    ["Linux", "Docker", "Kubernetes", "CI/CD", "Cloud Platform", "Networking", "Infrastructure as Code"],
}

CAREER_CERTIFICATIONS: dict[str, list[str]] = {
    "AI Engineer":       ["TensorFlow Developer", "AWS ML Specialty", "Google Cloud ML Engineer", "Deep Learning Specialization"],
    "Data Scientist":    ["Google Data Analytics", "IBM Data Science", "Databricks Associate", "SAS Certified"],
    "ML Engineer":       ["AWS ML Specialty", "Google Cloud ML Engineer", "MLflow Certified", "Kubeflow"],
    "Software Developer":["AWS Solutions Architect", "Google Associate Cloud", "Kubernetes CKA", "Oracle Java"],
    "Data Analyst":      ["Google Data Analytics", "Microsoft Power BI", "Tableau Desktop", "IBM Data Analyst"],
    "Backend Developer": ["AWS Developer", "MongoDB Associate", "PostgreSQL Associate", "Node.js Certified"],
    "DevOps Engineer":   ["AWS DevOps Pro", "CKA", "HashiCorp Terraform", "GitLab Certified"],
}

CAREER_PROJECTS: dict[str, list[str]] = {
    "AI Engineer":       ["Image Classification System", "NLP Chatbot", "Object Detection Pipeline", "Recommendation Engine"],
    "Data Scientist":    ["EDA + Dashboard", "Predictive Model Deployment", "Customer Segmentation", "A/B Test Analysis"],
    "ML Engineer":       ["ML Pipeline with MLflow", "Model Serving API", "Feature Store", "AutoML System"],
    "Software Developer":["REST API Project", "CRUD Application", "CLI Tool", "Open Source Contribution"],
    "Data Analyst":      ["Interactive Dashboard", "KPI Report Automation", "SQL Analysis Project", "Business Intelligence Report"],
    "Backend Developer": ["Microservices App", "REST API with Auth", "Database Design Project", "API Rate Limiter"],
    "DevOps Engineer":   ["CI/CD Pipeline", "Kubernetes Deployment", "Infrastructure as Code", "Monitoring Stack"],
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
    missing = [r for r in required if r.lower() not in user_context.lower()]
    pct = round(len(matched) / len(keywords) * 100) if keywords else 0
    return pct, [m.title() for m in matched], missing[:5]


# ── Shared resume analysis logic ───────────────────────────────────────────

def _run_resume_analysis(resume_text: str, target_role: str) -> dict:
    prompt = f"""You are an expert resume reviewer, ATS specialist, and career coach.
Analyze this resume for a {target_role} role. Be thorough and specific.

RESUME:
{resume_text[:5000]}

Respond ONLY with valid JSON in this exact structure:
{{
  "score": <0-100>,
  "ats_score": <0-100>,
  "formatting_score": <0-100>,
  "content_score": <0-100>,
  "keyword_score": <0-100>,
  "industry_relevance": "<1 sentence on how well it fits {target_role}>",
  "strengths": ["s1", "s2", "s3"],
  "weaknesses": ["w1", "w2", "w3"],
  "grammar_issues": ["g1", "g2"],
  "formatting_issues": ["f1", "f2"],
  "suggestions": ["suggestion1", "suggestion2", "suggestion3", "suggestion4"],
  "missing_keywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "sections": [
    {{"name": "Contact Info",     "score": <0-100>, "feedback": "...", "suggestions": ["..."]}},
    {{"name": "Summary/Objective","score": <0-100>, "feedback": "...", "suggestions": ["..."]}},
    {{"name": "Experience",       "score": <0-100>, "feedback": "...", "suggestions": ["..."]}},
    {{"name": "Education",        "score": <0-100>, "feedback": "...", "suggestions": ["..."]}},
    {{"name": "Skills",           "score": <0-100>, "feedback": "...", "suggestions": ["..."]}},
    {{"name": "Projects",         "score": <0-100>, "feedback": "...", "suggestions": ["..."]}}
  ],
  "bullet_improvements": [
    {{"section": "Experience", "original": "<exact weak bullet from resume>", "improved": "<stronger version with metrics>", "reason": "<why it's better>"}},
    {{"section": "Projects",   "original": "<exact weak bullet>",            "improved": "<stronger version>",             "reason": "..."}},
    {{"section": "Experience", "original": "<another weak bullet>",          "improved": "<stronger version>",             "reason": "..."}}
  ]
}}"""
    return _groq_json(prompt, max_tokens=2000) or {}


# ── 1. Career Overview ─────────────────────────────────────────────────────

@router.get("/overview", response_model=CareerReadinessResponse)
def get_career_overview(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    profile  = db.query(StudentProfile).filter_by(user_id=current_user.id).first()
    entries  = db.query(LearningData).filter_by(user_id=current_user.id).order_by(LearningData.date).all()
    records  = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()
    quizzes  = db.query(QuizSession).filter_by(user_id=current_user.id).filter(QuizSession.score.isnot(None)).all()

    subj_scores = [r.score for r in records]
    if subj_scores:
        academic_score = _safe_avg(subj_scores)
    else:
        fb = [e.exam_scores for e in entries if e.exam_scores] + [e.quiz_scores for e in entries if e.quiz_scores]
        academic_score = _safe_avg(fb) if fb else 0.0

    consistency_score  = _safe_avg([e.attendance_percentage     for e in entries])
    assignment_score   = _safe_avg([e.assignment_completion_rate for e in entries])
    study_score        = _safe_avg([min(e.study_hours / 6.0, 1.0) * 100 for e in entries])
    conf_vals          = [(r.confidence / 5.0) * 100 for r in records]
    confidence_score   = _safe_avg(conf_vals) if conf_vals else 50.0

    qv: list[float] = []
    for qs in quizzes:
        if qs.total and qs.total > 0: qv.append((qs.score / qs.total) * 100)
    for e in entries:
        if e.quiz_scores: qv.append(e.quiz_scores)
    quiz_score = _safe_avg(qv)

    today  = date.today()
    recent = {e.date for e in entries if (today - e.date).days <= 7}
    engagement_score = min(len(recent) / 5.0, 1.0) * 100

    has_data = bool(entries or records)
    overall = int(round(min(max(
        (academic_score * 0.25 + consistency_score * 0.20 + quiz_score * 0.15 +
         assignment_score * 0.15 + study_score * 0.15 + confidence_score * 0.05 +
         engagement_score * 0.05) if has_data else 0, 0), 100)))

    grade = "A" if overall >= 85 else "B" if overall >= 70 else "C" if overall >= 55 else "D"
    components = {
        "Academic Performance": round(academic_score, 1),
        "Consistency":          round(consistency_score, 1),
        "Quiz Performance":     round(quiz_score, 1),
        "Assignment Completion":round(assignment_score, 1),
        "Study Dedication":     round(study_score, 1),
        "Confidence":           round(confidence_score, 1),
        "Engagement":           round(engagement_score, 1),
    }
    sorted_comps = sorted(components.items(), key=lambda x: x[1], reverse=True)
    strengths    = [k for k, v in sorted_comps if v >= 65][:3]
    improvements = [k for k, v in sorted_comps if v < 65][:3]

    if len(entries) >= 3:
        r_entries = sorted(entries, key=lambda e: e.date)[-10:]
        trend = r_entries[-1].study_hours - r_entries[0].study_hours
        prob  = min(95, max(30, overall + int(trend * 3)))
    else:
        prob = max(20, int(overall * 0.8))

    subjects = list({r.subject for r in records})
    if profile and profile.subjects:
        subjects += [s.strip() for s in profile.subjects.split(",") if s.strip()]
    top_role = _best_role(subjects, profile)

    return CareerReadinessResponse(
        score=overall, grade=grade,
        strengths=strengths or ["Getting Started"],
        areas_to_improve=improvements or ["Build more learning data"],
        component_scores=components,
        twin_prediction=(
            f"Your Digital Twin predicts a {prob}% probability of becoming job-ready for "
            f"{top_role} roles within 6 months, based on your learning trajectory."
        ),
        job_readiness_probability=round(prob / 100, 2),
    )


# ── 2. Resume upload (multipart) ───────────────────────────────────────────

@router.post("/resume/upload", response_model=ResumeAnalyzeResponse)
async def upload_resume(
    file: UploadFile = File(...),
    target_role: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    content = await file.read()
    if len(content) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_UPLOAD_MB} MB limit.")

    fname = (file.filename or "").lower()
    if fname.endswith(".pdf"):
        text = _extract_pdf(content)
    elif fname.endswith(".docx"):
        text = _extract_docx(content)
    elif fname.endswith(".txt"):
        text = content.decode("utf-8", errors="replace")
    else:
        raise HTTPException(status_code=415, detail="Only PDF, DOCX, and TXT files are supported.")

    if not text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from this file.")

    role = target_role.strip() or "Software Developer"
    data = _run_resume_analysis(text, role)
    if not data:
        raise HTTPException(status_code=500, detail="AI analysis failed. Please try again.")

    sections = [ResumeSection(
        name=s.get("name", ""),
        score=int(s.get("score", 50)),
        feedback=s.get("feedback", ""),
        suggestions=s.get("suggestions", []),
    ) for s in data.get("sections", [])]

    bullets = [BulletImprovement(**b) for b in data.get("bullet_improvements", []) if isinstance(b, dict)]

    # Extract skills from resume text for Career Twin
    skill_keywords = [kw for kws in CAREER_SKILLS.values() for kw in kws]
    detected_skills = [kw.title() for kw in skill_keywords if kw in text.lower()]

    resume_score = float(data.get("score", 60))
    _update_twin(current_user.id, db,
                 resume_score=resume_score,
                 skills=detected_skills[:20],
                 resume_text=text[:8000],
                 event="resume_upload")

    return ResumeAnalyzeResponse(
        score=int(data.get("score", 60)),
        ats_score=int(data.get("ats_score", 55)),
        formatting_score=int(data.get("formatting_score", 60)),
        content_score=int(data.get("content_score", 60)),
        keyword_score=int(data.get("keyword_score", 50)),
        industry_relevance=data.get("industry_relevance", ""),
        strengths=data.get("strengths", []),
        weaknesses=data.get("weaknesses", []),
        grammar_issues=data.get("grammar_issues", []),
        formatting_issues=data.get("formatting_issues", []),
        suggestions=data.get("suggestions", []),
        missing_keywords=data.get("missing_keywords", []),
        sections=sections,
        bullet_improvements=bullets,
        twin_updated=True,
    )


# ── 2b. Resume analyze (text paste, backward-compat) ──────────────────────

@router.post("/resume/analyze", response_model=ResumeAnalyzeResponse)
def analyze_resume(
    payload: ResumeAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    role = payload.target_role or "Software Developer"
    data = _run_resume_analysis(payload.resume_text, role)
    if not data:
        raise HTTPException(status_code=500, detail="AI analysis failed.")

    sections = [ResumeSection(
        name=s.get("name", ""), score=int(s.get("score", 50)),
        feedback=s.get("feedback", ""), suggestions=s.get("suggestions", []),
    ) for s in data.get("sections", [])]
    bullets = [BulletImprovement(**b) for b in data.get("bullet_improvements", []) if isinstance(b, dict)]

    resume_score = float(data.get("score", 60))
    _update_twin(current_user.id, db, resume_score=resume_score,
                 resume_text=payload.resume_text[:8000], event="resume_analyze")

    return ResumeAnalyzeResponse(
        score=int(data.get("score", 60)),
        ats_score=int(data.get("ats_score", 55)),
        formatting_score=int(data.get("formatting_score", 60)),
        content_score=int(data.get("content_score", 60)),
        keyword_score=int(data.get("keyword_score", 50)),
        industry_relevance=data.get("industry_relevance", ""),
        strengths=data.get("strengths", []),
        weaknesses=data.get("weaknesses", []),
        grammar_issues=data.get("grammar_issues", []),
        formatting_issues=data.get("formatting_issues", []),
        suggestions=data.get("suggestions", []),
        missing_keywords=data.get("missing_keywords", []),
        sections=sections,
        bullet_improvements=bullets,
        twin_updated=True,
    )


# ── 3. LinkedIn Optimizer ──────────────────────────────────────────────────

@router.post("/linkedin/analyze", response_model=LinkedInAnalyzeResponse)
def analyze_linkedin(
    payload: LinkedInAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    role = payload.target_role or "Software Developer"
    prompt = f"""You are a LinkedIn optimization expert and personal branding specialist.
Analyze this LinkedIn profile for a {role} role. Be detailed and specific.

PROFILE:
{payload.profile_text[:5000]}

Respond ONLY with valid JSON:
{{
  "score": <0-100>,
  "visibility_score": <0-100>,
  "personal_brand_score": <0-100>,
  "recruiter_score": <0-100>,
  "section_scores": {{
    "Headline": <0-100>, "About": <0-100>, "Experience": <0-100>,
    "Skills": <0-100>, "Education": <0-100>, "Recommendations": <0-100>
  }},
  "optimized_headline": "<compelling headline under 220 chars>",
  "optimized_summary": "<improved About section, 4-5 sentences, first-person, metrics-driven>",
  "suggestions": ["s1", "s2", "s3", "s4"],
  "missing_skills": ["skill1", "skill2", "skill3"],
  "missing_certifications": ["cert1", "cert2"],
  "networking_suggestions": ["ns1", "ns2", "ns3"],
  "keyword_recommendations": ["kw1", "kw2", "kw3", "kw4"]
}}"""
    data = _groq_json(prompt, max_tokens=1400)
    if not data or not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="AI analysis failed.")

    li_score = float(data.get("score", 60))
    _update_twin(current_user.id, db, linkedin_score=li_score, event="linkedin_analyze")

    return LinkedInAnalyzeResponse(
        score=int(data.get("score", 60)),
        visibility_score=int(data.get("visibility_score", 55)),
        personal_brand_score=int(data.get("personal_brand_score", 55)),
        recruiter_score=int(data.get("recruiter_score", 50)),
        section_scores=data.get("section_scores", {}),
        optimized_headline=data.get("optimized_headline", ""),
        optimized_summary=data.get("optimized_summary", ""),
        suggestions=data.get("suggestions", []),
        missing_skills=data.get("missing_skills", []),
        missing_certifications=data.get("missing_certifications", []),
        networking_suggestions=data.get("networking_suggestions", []),
        keyword_recommendations=data.get("keyword_recommendations", []),
        twin_updated=True,
    )


# ── 4. Mock Interview ──────────────────────────────────────────────────────

@router.post("/interview/chat", response_model=InterviewChatResponse)
def interview_chat(
    payload: InterviewChatRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    client = _get_client()
    total_q = 8
    user_messages = [m for m in payload.history if m.role == "user"]
    q_num = len(user_messages) + 1

    if payload.mode == "evaluate" or q_num > total_q:
        convo = "\n".join(f"{m.role.upper()}: {m.content}" for m in payload.history)
        eval_prompt = f"""You are an expert technical interviewer evaluating a mock interview for a {payload.role} position.

INTERVIEW TRANSCRIPT:
{convo[:3500]}

Score the candidate (0-100) on each dimension and provide detailed feedback.
Respond ONLY with valid JSON:
{{
  "interview_score": <0-100>,
  "communication_score": <0-100>,
  "confidence_score": <0-100>,
  "technical_score": <0-100>,
  "problem_solving_score": <0-100>,
  "feedback": "<3-4 sentence overall assessment>",
  "strengths": ["s1", "s2", "s3"],
  "improvements": ["i1", "i2", "i3"],
  "weak_areas": ["wa1", "wa2"],
  "improvement_plan": ["step1", "step2", "step3"]
}}"""
        data = _groq_json(eval_prompt, max_tokens=800) or {}
        iv_score = float(data.get("interview_score", 65))
        _update_twin(current_user.id, db, interview_score=iv_score, event="interview")

        return InterviewChatResponse(
            message=f"Interview complete!\n\n{data.get('feedback', 'Great effort on your mock interview!')}",
            is_complete=True,
            scores={
                "interview":        int(data.get("interview_score", 65)),
                "communication":    int(data.get("communication_score", 70)),
                "confidence":       int(data.get("confidence_score", 65)),
                "technical":        int(data.get("technical_score", 60)),
                "problem_solving":  int(data.get("problem_solving_score", 60)),
            },
            feedback=data.get("feedback", ""),
            strengths=data.get("strengths", []),
            improvements=data.get("improvements", []),
            twin_updated=True,
        )

    history_msgs = [{"role": m.role, "content": m.content} for m in payload.history]
    sys_prompt = (
        f"You are a professional interviewer conducting a mock interview for a {payload.role} position. "
        f"Ask {total_q} questions mixing technical, behavioral, HR, and situation-based questions. "
        f"This is question {q_num} of {total_q}. Ask ONE clear question. No numbering. No feedback."
    )
    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "system", "content": sys_prompt}] + history_msgs,
        temperature=0.6,
        max_tokens=200,
    )
    return InterviewChatResponse(
        message=resp.choices[0].message.content.strip(),
        question_number=q_num,
        total_questions=total_q,
        is_complete=False,
    )


# ── 5. Coding ──────────────────────────────────────────────────────────────

@router.post("/coding/challenge", response_model=CodingChallengeResponse)
def get_coding_challenge(
    payload: CodingChallengeRequest,
    current_user: User = Depends(get_current_user),
):
    prompt = f"""Generate a {payload.difficulty} difficulty coding problem on {payload.topic}.
Make it realistic and interview-worthy.

Respond ONLY with valid JSON:
{{
  "title": "<problem title>",
  "problem": "<full problem statement>",
  "examples": [
    {{"input": "...", "output": "...", "explanation": "..."}},
    {{"input": "...", "output": "...", "explanation": "..."}}
  ],
  "hints": ["hint1", "hint2", "hint3"],
  "constraints": ["constraint1", "constraint2", "constraint3"],
  "expected_approach": "<brief description of optimal approach>"
}}"""
    data = _groq_json(prompt, max_tokens=1000)
    if not data or not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="Failed to generate challenge.")
    examples = [CodingExample(**e) for e in data.get("examples", []) if isinstance(e, dict)]
    return CodingChallengeResponse(
        title=data.get("title", "Coding Challenge"),
        problem=data.get("problem", ""),
        examples=examples,
        hints=data.get("hints", []),
        difficulty=payload.difficulty,
        topic=payload.topic,
        constraints=data.get("constraints", []),
        expected_approach=data.get("expected_approach", ""),
    )


@router.post("/coding/evaluate", response_model=CodingEvalResponse)
def evaluate_coding(
    payload: CodingEvalRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    prompt = f"""Evaluate this {payload.language} solution for the coding problem.

PROBLEM: {payload.problem[:800]}

SOLUTION:
{payload.solution[:2000]}

Respond ONLY with valid JSON:
{{
  "score": <0-100>,
  "is_correct": <true|false>,
  "feedback": "<2-3 sentence assessment>",
  "time_complexity": "<Big-O>",
  "space_complexity": "<Big-O>",
  "approach_quality": "<Optimal|Good|Acceptable|Needs Work>",
  "improvements": ["imp1", "imp2", "imp3"]
}}"""
    data = _groq_json(prompt, max_tokens=600) or {}
    coding_score = float(data.get("score", 60))
    _update_twin(current_user.id, db, coding_score=coding_score, event="coding")
    return CodingEvalResponse(
        score=int(data.get("score", 60)),
        is_correct=bool(data.get("is_correct", False)),
        feedback=data.get("feedback", ""),
        time_complexity=data.get("time_complexity", "Unknown"),
        space_complexity=data.get("space_complexity", "Unknown"),
        approach_quality=data.get("approach_quality", "Needs Work"),
        improvements=data.get("improvements", []),
        twin_updated=True,
    )


# ── 6. Skill Gap ──────────────────────────────────────────────────────────

@router.get("/skill-gap", response_model=SkillGapResponse)
def get_skill_gap(
    target: str = Query("AI Engineer"),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    profile = db.query(StudentProfile).filter_by(user_id=current_user.id).first()
    records = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()
    twin    = db.query(CareerTwin).filter_by(user_id=current_user.id).first()

    user_subjects: set[str] = set()
    if profile and profile.subjects:
        for s in profile.subjects.split(","):
            if s.strip(): user_subjects.add(s.strip())
    for r in records: user_subjects.add(r.subject)
    if twin and twin.skills_json:
        for s in json.loads(twin.skills_json): user_subjects.add(s)

    context = " ".join(user_subjects).lower()
    if profile: context += f" {profile.course} {profile.academic_goals}".lower()

    required = CAREER_REQUIRED_SKILLS.get(target, [])
    missing  = [r for r in required if r.lower() not in context]
    current_skills = [r for r in required if r.lower() in context]

    miss_certs   = CAREER_CERTIFICATIONS.get(target, [])[:4]
    miss_projects= CAREER_PROJECTS.get(target, [])[:4]

    compat = round(len(current_skills) / len(required) * 100) if required else 0
    priority = (
        "Critical — start immediately with foundational skills" if compat < 30 else
        "High — focus on core missing skills" if compat < 60 else
        "Medium — refine and add advanced skills" if compat < 80 else
        "Low — polish and specialize"
    )

    prompt = f"""Create a 5-step learning roadmap for a student targeting a {target} role.
Current skills: {', '.join(list(user_subjects)[:8]) if user_subjects else 'None yet'}
Missing skills: {', '.join(missing)}

Respond ONLY with valid JSON array (5 steps):
[{{"step":1,"title":"...","description":"...","resources":["r1","r2"],"duration":"..."}},...]"""
    plan_data = _groq_json(prompt, max_tokens=900)
    plan = [LearningStep(**s) for s in plan_data if isinstance(s, dict)] if isinstance(plan_data, list) else [
        LearningStep(step=1, title="Build Foundation", description=f"Learn {missing[0] if missing else 'core concepts'}.", resources=["Coursera", "YouTube"], duration="3 weeks")
    ]

    return SkillGapResponse(
        target_career=target,
        current_skills=list(user_subjects) or ["No data yet — add subjects in your profile"],
        missing_skills=missing,
        missing_certifications=miss_certs,
        missing_projects=miss_projects,
        learning_plan=plan,
        compatibility_score=compat,
        learning_priority=priority,
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

    context   = " ".join(user_subjects).lower()
    if profile: context += f" {profile.course} {profile.academic_goals}".lower()
    avg_score = _safe_avg([r.score for r in records]) if records else 50.0
    avg_study = _safe_avg([e.study_hours for e in entries]) if entries else 0.0

    recs: list[CareerRecommendation] = []
    for role, required in CAREER_REQUIRED_SKILLS.items():
        pct, matched, missing = _match_score(context, role)
        boosted = min(100, int(pct * 0.6 + avg_score * 0.3 + min(avg_study / 6, 1) * 10))
        recs.append(CareerRecommendation(
            role=role, compatibility=boosted,
            reasoning=f"Your profile shows {len(matched)} keyword matches for {role}.",
            required_skills=required[:5], key_matches=matched[:4],
        ))
    recs.sort(key=lambda r: r.compatibility, reverse=True)
    top = recs[0].role if recs else "Software Developer"

    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": (
                f"Student: {profile.course if profile else 'General'}, subjects: {', '.join(list(user_subjects)[:5]) if user_subjects else 'various'}. "
                f"Avg score: {avg_score:.0f}%. Top career match: {top}. "
                "Write one compelling sentence (max 30 words) predicting their career from Digital Twin perspective."
            )}],
            temperature=0.5, max_tokens=80,
        )
        twin_insight = resp.choices[0].message.content.strip().strip('"')
    except Exception:
        twin_insight = f"Your learning trajectory strongly points toward a {top} career path."

    return CareerRecommendationsResponse(recommendations=recs[:6], top_match=top, twin_insight=twin_insight)


# ── 8. Job Matching ───────────────────────────────────────────────────────

@router.get("/job-matching", response_model=JobMatchResponse)
def get_job_matching(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    profile = db.query(StudentProfile).filter_by(user_id=current_user.id).first()
    records = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()
    entries = db.query(LearningData).filter_by(user_id=current_user.id).all()
    twin    = db.query(CareerTwin).filter_by(user_id=current_user.id).first()

    user_subjects: set[str] = set()
    if profile and profile.subjects:
        for s in profile.subjects.split(","):
            if s.strip(): user_subjects.add(s.strip())
    for r in records: user_subjects.add(r.subject)

    context   = " ".join(user_subjects).lower()
    if profile: context += f" {profile.course} {profile.academic_goals}".lower()
    avg_score = _safe_avg([r.score for r in records]) if records else 50.0

    resume_r   = int(twin.resume_score    if twin else 0)
    interview_r= int(twin.interview_score if twin else 0)

    matches: list[JobMatchEntry] = []
    for role in CAREER_REQUIRED_SKILLS:
        pct, matched, missing = _match_score(context, role)
        final     = min(99, int(pct * 0.60 + avg_score * 0.25 + 15))
        gap_pct   = 100 - final
        res_ready = min(99, resume_r + 5)
        int_ready = min(99, interview_r + 5)
        matches.append(JobMatchEntry(
            role=role, match_percent=final, skill_gap_percent=gap_pct,
            resume_readiness=res_ready, interview_readiness=int_ready,
            reasoning=f"Matched {len(matched)} of {len(CAREER_SKILLS.get(role, []))} keywords.",
            key_skills_matched=matched[:4], missing_skills=missing[:3],
            recommended_certifications=CAREER_CERTIFICATIONS.get(role, [])[:2],
            portfolio_projects=CAREER_PROJECTS.get(role, [])[:2],
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
    avg_score     = _safe_avg([r.score for r in records]) if records else 50.0

    prompt = f"""Create a personalized career roadmap for a student targeting a {target} role.
Current position: {current_pos}
Known subjects/skills: {', '.join(user_subjects[:6]) if user_subjects else 'General studies'}
Current performance: {avg_score:.0f}%

Generate a 6-step roadmap with monthly milestones. Respond ONLY with valid JSON:
{{
  "estimated_time": "<e.g. '9-12 months'>",
  "steps": [
    {{"step":1,"title":"...","description":"...","duration":"...","resources":["r1","r2"],"skills":["s1","s2"],"status":"current"}},
    ...6 steps total...
  ],
  "monthly_milestones": [
    {{"month":1,"goal":"...","deliverable":"..."}},
    {{"month":3,"goal":"...","deliverable":"..."}},
    {{"month":6,"goal":"...","deliverable":"..."}},
    {{"month":12,"goal":"...","deliverable":"..."}}
  ]
}}"""
    data = _groq_json(prompt, max_tokens=1400)

    if isinstance(data, dict) and "steps" in data:
        steps = [RoadmapStep(**s) for s in data["steps"] if isinstance(s, dict)]
        estimated = data.get("estimated_time", "9-12 months")
        milestones = data.get("monthly_milestones", [])
    else:
        steps = [
            RoadmapStep(step=1, title="Build Foundations", description="Master core fundamentals.", duration="1 month", resources=["Coursera"], skills=["Python"], status="current"),
            RoadmapStep(step=2, title="Learn Key Tools",   description="Study essential tools.",   duration="2 months", resources=["YouTube"], skills=["Libraries"], status="pending"),
            RoadmapStep(step=3, title="Build Projects",    description="Create portfolio work.",   duration="2 months", resources=["GitHub"],  skills=["Projects"],  status="pending"),
            RoadmapStep(step=4, title="Interview Prep",    description="Practice mock interviews.",duration="1 month", resources=["LeetCode"],skills=["DSA"],      status="pending"),
        ]
        estimated  = "6-8 months"
        milestones = []

    prob = min(0.95, max(0.3, avg_score / 100 + 0.05))
    return RoadmapResponse(
        current_position=current_pos, target_career=target,
        steps=steps, estimated_time=estimated,
        twin_success_probability=round(prob, 2),
        monthly_milestones=milestones,
    )


# ── 10. Career Twin ────────────────────────────────────────────────────────

@router.get("/twin", response_model=CareerTwinResponse)
def get_career_twin(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    twin    = _get_or_create_twin(current_user.id, db)
    profile = db.query(StudentProfile).filter_by(user_id=current_user.id).first()
    entries = db.query(LearningData).filter_by(user_id=current_user.id).all()
    records = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()

    # Career Twin Score = weighted avg of all components
    r = twin.resume_score; li = twin.linkedin_score
    iv = twin.interview_score; co = twin.coding_score
    ct_score = int(round(r * 0.30 + li * 0.20 + iv * 0.25 + co * 0.25))

    # Employability blends Career Twin + academic performance
    avg_acad = _safe_avg([rec.score for rec in records]) if records else 50.0
    employability = int(round(ct_score * 0.60 + avg_acad * 0.40))

    # Industry and interview readiness
    industry_r  = int(round((avg_acad * 0.5 + co * 0.5)))
    interview_r = int(round(iv if iv > 0 else avg_acad * 0.7))

    # Predictions — simple linear extrapolation + 10-20% monthly gain
    history = json.loads(twin.score_history_json or "[]")
    if len(history) >= 2:
        emp_vals = [h["employability"] for h in history[-5:] if "employability" in h]
        slope = (emp_vals[-1] - emp_vals[0]) / max(len(emp_vals) - 1, 1) if len(emp_vals) > 1 else 2
    else:
        slope = max(2, (100 - employability) * 0.05)  # conservative 5% headroom

    def _predict(months: int) -> CareerTwinPrediction:
        gain = slope * months * 1.5
        return CareerTwinPrediction(
            months=months,
            career_twin_score    =min(99, ct_score      + int(gain)),
            employability_score  =min(99, employability + int(gain)),
            interview_readiness  =min(99, interview_r   + int(gain * 0.8)),
            industry_readiness   =min(99, industry_r    + int(gain * 0.6)),
        )

    # AI insight
    subjects = [r.subject for r in records]
    top_role = _best_role(subjects, profile)
    try:
        client = _get_client()
        resp   = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": (
                f"Digital Twin career scores: Resume={r:.0f}, LinkedIn={li:.0f}, "
                f"Interview={iv:.0f}, Coding={co:.0f}. Target role: {top_role}. "
                "Write one specific, motivating prediction sentence (max 35 words) about career readiness."
            )}],
            temperature=0.5, max_tokens=80,
        )
        insight = resp.choices[0].message.content.strip().strip('"')
    except Exception:
        insight = f"Your Career Twin is evolving — consistent effort will unlock {top_role} opportunities."

    label = (
        "Highly Employable" if ct_score >= 80 else
        "Interview Ready"   if ct_score >= 65 else
        "Building Profile"  if ct_score >= 40 else
        "Early Stage"
    )

    return CareerTwinResponse(
        career_twin_score=ct_score,
        employability_score=employability,
        interview_readiness=interview_r,
        industry_readiness=industry_r,
        resume_score=int(r), linkedin_score=int(li),
        interview_score=int(iv), coding_score=int(co),
        skills=json.loads(twin.skills_json or "[]"),
        certifications=json.loads(twin.certifications_json or "[]"),
        last_updated=twin.updated_at.isoformat() if twin.updated_at else None,
        predictions={"3m": _predict(3), "6m": _predict(6), "12m": _predict(12)},
        score_history=history[-30:],
        twin_insight=insight,
        current_state_label=label,
    )


# ── 11. Analytics ──────────────────────────────────────────────────────────

@router.get("/analytics", response_model=AnalyticsResponse)
def get_analytics(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    twin    = db.query(CareerTwin).filter_by(user_id=current_user.id).first()
    records = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()
    profile = db.query(StudentProfile).filter_by(user_id=current_user.id).first()

    history = json.loads(twin.score_history_json or "[]") if twin else []

    # Career twin trend
    twin_trend = [
        {"date": h["date"], "Career Twin": int(h.get("employability", 0))}
        for h in history
    ]

    # Score breakdown trend (multi-line)
    breakdown_trend = [
        {
            "date":      h["date"],
            "Resume":    int(h.get("resume",    0)),
            "LinkedIn":  int(h.get("linkedin",  0)),
            "Interview": int(h.get("interview", 0)),
            "Coding":    int(h.get("coding",    0)),
        }
        for h in history
    ]

    # Radar: current skills vs required for top role
    subjects = {r.subject.lower() for r in records}
    if profile and profile.subjects:
        subjects.update(s.strip().lower() for s in profile.subjects.split(","))
    context = " ".join(subjects)
    top_role = _best_role(list(subjects), profile)
    required = CAREER_SKILLS.get(top_role, [])
    radar = [
        {"skill": kw.title(), "current": 100 if kw in context else 20, "target": 100}
        for kw in required[:8]
    ]

    # Insights
    improvements = []
    if twin:
        scores = {"Resume": twin.resume_score, "LinkedIn": twin.linkedin_score,
                  "Interview": twin.interview_score, "Coding": twin.coding_score}
        least = min(scores, key=lambda k: scores[k])
        improvements.append(least)

    total = len(history)
    consistency = round(min(total / 10, 1.0) * 100, 1)

    return AnalyticsResponse(
        career_twin_trend=twin_trend,
        score_breakdown_trend=breakdown_trend,
        skill_radar=radar,
        total_analyses=total,
        top_improvement=improvements[0] if improvements else "Keep analyzing",
        consistency_score=consistency,
    )
