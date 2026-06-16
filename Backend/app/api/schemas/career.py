from pydantic import BaseModel
from typing import List, Optional, Dict, Any


# ── Career Readiness (overview) ─────────────────────────────────────────────

class CareerReadinessResponse(BaseModel):
    score: int
    grade: str
    strengths: List[str]
    areas_to_improve: List[str]
    component_scores: Dict[str, float]
    twin_prediction: str
    job_readiness_probability: float


# ── Resume ──────────────────────────────────────────────────────────────────

class ResumeAnalyzeRequest(BaseModel):
    resume_text: str
    target_role: Optional[str] = None


class ResumeSection(BaseModel):
    name: str
    score: int
    feedback: str
    suggestions: List[str] = []


class BulletImprovement(BaseModel):
    section: str
    original: str
    improved: str
    reason: str


class ResumeAnalyzeResponse(BaseModel):
    score: int
    ats_score: int
    formatting_score: int
    content_score: int
    keyword_score: int
    industry_relevance: str
    strengths: List[str]
    weaknesses: List[str]
    grammar_issues: List[str]
    formatting_issues: List[str]
    suggestions: List[str]
    missing_keywords: List[str]
    sections: List[ResumeSection]
    bullet_improvements: List[BulletImprovement]
    twin_updated: bool = False


# ── LinkedIn ─────────────────────────────────────────────────────────────────

class LinkedInAnalyzeRequest(BaseModel):
    profile_text: str
    target_role: Optional[str] = None


class LinkedInAnalyzeResponse(BaseModel):
    score: int
    visibility_score: int
    personal_brand_score: int
    recruiter_score: int
    section_scores: Dict[str, int]
    optimized_headline: str
    optimized_summary: str
    suggestions: List[str]
    missing_skills: List[str]
    missing_certifications: List[str]
    networking_suggestions: List[str]
    keyword_recommendations: List[str]
    twin_updated: bool = False


# ── LinkedIn Digital Twin ─────────────────────────────────────────────────────

class AchievementItem(BaseModel):
    id: str
    title: str
    achievement_type: str          # certificate|internship|project|skill|other
    raw_text: str
    skills_gained: List[str]
    technologies: List[str]
    difficulty_level: str          # Beginner|Intermediate|Advanced
    career_value: str
    industry_relevance: str
    impact_score: int
    career_value_score: int
    recruiter_appeal_score: int
    why_it_matters: str
    how_it_improves: str
    career_paths_supported: List[str]
    uploaded_at: str


class AchievementAnalyzeResponse(BaseModel):
    achievement: AchievementItem
    twin_updated: bool = True


class LinkedInImprovementItem(BaseModel):
    section: str
    current_version: str
    suggested_version: str
    reason: str


class LinkedInChecklistItem(BaseModel):
    key: str
    label: str
    completed: bool
    recommendation: str


class LinkedInTwinPrediction(BaseModel):
    months: int
    career_growth: str
    recruiter_interest: int
    employability_score: int
    skill_growth: str
    opportunities: List[str]


class LinkedInSectionScore(BaseModel):
    name: str
    score: int
    feedback: str
    suggestion: str


class LinkedInTwinFullResponse(BaseModel):
    # Five core scores
    profile_strength: int
    recruiter_visibility: int
    personal_branding: int
    industry_relevance_score: int
    network_readiness: int
    overall_score: int

    # Per-section scores
    sections: List[LinkedInSectionScore]

    # Generated content
    suggested_headline: str
    suggested_about: str

    # Before/After improvements
    improvements: List[LinkedInImprovementItem]

    # Optimization checklist
    checklist: List[LinkedInChecklistItem]
    checklist_completion: int

    # AI recommendations
    suitable_roles: List[str]
    internship_opportunities: List[str]
    missing_skills: List[str]
    missing_certifications: List[str]
    important_projects: List[str]
    learning_priorities: List[str]

    # Stored achievements
    achievements: List[AchievementItem]
    achievements_count: int

    # Predictions
    predictions: Dict[str, LinkedInTwinPrediction]

    # Meta
    last_analyzed: Optional[str]
    twin_insight: str
    twin_updated: bool = True


class ManualAchievementRequest(BaseModel):
    title: str
    description: str
    achievement_type: str = "achievement"


# ── Interview ─────────────────────────────────────────────────────────────────

class InterviewMsg(BaseModel):
    role: str
    content: str


class InterviewChatRequest(BaseModel):
    role: str
    history: List[InterviewMsg]
    mode: str = "question"          # "question" | "evaluate"
    category: str = "HR"            # interview round / category
    profile_context: str = ""       # brief profile summary for personalisation
    interviewer_mode: str = "friendly"  # friendly | technical | panel | stress
    domain: str = ""                # auto-detected if blank


class InterviewChatResponse(BaseModel):
    message: str
    question_number: Optional[int] = None
    total_questions: int = 8
    is_complete: bool = False
    scores: Optional[Dict[str, int]] = None
    feedback: Optional[str] = None
    strengths: List[str] = []
    improvements: List[str] = []
    weak_areas: List[str] = []
    improvement_plan: List[str] = []
    twin_updated: bool = False
    domain: str = ""
    category: str = ""
    interview_iq: Optional[int] = None


# ── Interview Vocabulary ───────────────────────────────────────────────────

class VocabularyItem(BaseModel):
    word: str
    meaning: str
    example: str
    tip: str


class VocabularyResponse(BaseModel):
    domain: str
    career: str
    items: List[VocabularyItem]


# ── Interview Scenario ─────────────────────────────────────────────────────

class ScenarioRequest(BaseModel):
    career: str
    domain: str
    scenario_type: str
    history: List[InterviewMsg] = []
    mode: str = "start"   # "start" | "continue" | "evaluate"


class ScenarioResponse(BaseModel):
    message: str
    scenario_type: str
    is_complete: bool = False
    score: Optional[int] = None
    feedback: Optional[str] = None
    tips: List[str] = []


# ── Interview Report ───────────────────────────────────────────────────────

class InterviewReportRequest(BaseModel):
    career: str
    domain: str
    category: str
    scores: Dict[str, int]
    feedback: str
    strengths: List[str]
    improvements: List[str]
    session_duration: int = 15      # minutes


class InterviewReportResponse(BaseModel):
    overall_score: int
    interview_iq: int
    iq_label: str                   # Beginner / Developing / Professional / Industry Ready / Elite
    readiness_pct: int
    estimated_readiness_pct: int
    predicted_timeline: str
    strengths: List[str]
    weaknesses: List[str]
    recommended_resources: List[str]
    next_practice_plan: List[str]
    domain: str
    career: str


# ── Interview Config ───────────────────────────────────────────────────────

class InterviewConfigResponse(BaseModel):
    domain: str
    domain_label: str
    career: str
    categories: Dict[str, str]      # category_name → focus_description
    eval_dimensions: List[str]
    question_count: int
    interviewer_modes: Dict[str, str]  # mode_id → description


# ── Skill Gap ────────────────────────────────────────────────────────────────

class LearningStep(BaseModel):
    step: int
    title: str
    description: str
    resources: List[str]
    duration: str


class SkillGapResponse(BaseModel):
    target_career: str
    current_skills: List[str]
    missing_skills: List[str]
    missing_certifications: List[str]
    missing_projects: List[str]
    learning_plan: List[LearningStep]
    compatibility_score: int
    learning_priority: str


# ── Career Recommendations ───────────────────────────────────────────────────

class CareerRecommendation(BaseModel):
    role: str
    compatibility: int
    reasoning: str
    required_skills: List[str]
    key_matches: List[str]


class CareerRecommendationsResponse(BaseModel):
    recommendations: List[CareerRecommendation]
    top_match: str
    twin_insight: str


# ── Job Matching ─────────────────────────────────────────────────────────────

class JobMatchEntry(BaseModel):
    role: str
    match_percent: int
    skill_gap_percent: int
    resume_readiness: int
    interview_readiness: int
    reasoning: str
    key_skills_matched: List[str]
    missing_skills: List[str]
    recommended_certifications: List[str]
    portfolio_projects: List[str]


class JobMatchResponse(BaseModel):
    matches: List[JobMatchEntry]
    top_role: str


# ── Roadmap ──────────────────────────────────────────────────────────────────

class RoadmapStep(BaseModel):
    step: int
    title: str
    description: str
    duration: str
    resources: List[str]
    skills: List[str]
    status: str = "pending"


class RoadmapResponse(BaseModel):
    current_position: str
    target_career: str
    steps: List[RoadmapStep]
    estimated_time: str
    twin_success_probability: float
    monthly_milestones: List[Dict[str, Any]]


# ── Coding ───────────────────────────────────────────────────────────────────

class CodingChallengeRequest(BaseModel):
    difficulty: str = "medium"
    topic: str = "arrays"


class CodingExample(BaseModel):
    input: str
    output: str
    explanation: Optional[str] = None


class CodingChallengeResponse(BaseModel):
    title: str
    problem: str
    examples: List[CodingExample]
    hints: List[str]
    difficulty: str
    topic: str
    constraints: List[str]
    expected_approach: str


class CodingEvalRequest(BaseModel):
    problem: str
    solution: str
    language: str = "python"


class CodingEvalResponse(BaseModel):
    score: int
    is_correct: bool
    feedback: str
    time_complexity: str
    space_complexity: str
    improvements: List[str]
    approach_quality: str
    twin_updated: bool = False


# ── Career Twin ──────────────────────────────────────────────────────────────

class CareerTwinPrediction(BaseModel):
    months: int
    career_twin_score: int
    employability_score: int
    interview_readiness: int
    industry_readiness: int


class CareerTwinResponse(BaseModel):
    career_twin_score: int
    employability_score: int
    interview_readiness: int
    industry_readiness: int
    resume_score: int
    linkedin_score: int
    interview_score: int
    coding_score: int
    skills: List[str]
    certifications: List[str]
    last_updated: Optional[str]
    predictions: Dict[str, CareerTwinPrediction]
    score_history: List[Dict[str, Any]]
    twin_insight: str
    current_state_label: str


# ── Analytics ────────────────────────────────────────────────────────────────

class AnalyticsResponse(BaseModel):
    career_twin_trend: List[Dict[str, Any]]
    score_breakdown_trend: List[Dict[str, Any]]
    skill_radar: List[Dict[str, Any]]
    total_analyses: int
    top_improvement: str
    consistency_score: float
