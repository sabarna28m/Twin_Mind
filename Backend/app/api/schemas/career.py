from pydantic import BaseModel
from typing import List, Optional, Dict


class CareerReadinessResponse(BaseModel):
    score: int
    grade: str
    strengths: List[str]
    areas_to_improve: List[str]
    component_scores: Dict[str, float]
    twin_prediction: str
    job_readiness_probability: float


class ResumeAnalyzeRequest(BaseModel):
    resume_text: str
    target_role: Optional[str] = None


class ResumeSection(BaseModel):
    name: str
    score: int
    feedback: str


class ResumeAnalyzeResponse(BaseModel):
    score: int
    ats_score: int
    strengths: List[str]
    suggestions: List[str]
    missing_keywords: List[str]
    sections: List[ResumeSection]


class LinkedInAnalyzeRequest(BaseModel):
    profile_text: str
    target_role: Optional[str] = None


class LinkedInAnalyzeResponse(BaseModel):
    score: int
    suggestions: List[str]
    optimized_headline: str
    optimized_summary: str
    missing_skills: List[str]
    section_scores: Dict[str, int]


class InterviewMsg(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class InterviewChatRequest(BaseModel):
    role: str
    history: List[InterviewMsg]
    mode: str = "question"   # "question" | "evaluate"


class InterviewChatResponse(BaseModel):
    message: str
    question_number: Optional[int] = None
    total_questions: int = 8
    is_complete: bool = False
    scores: Optional[Dict[str, int]] = None
    feedback: Optional[str] = None


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
    learning_plan: List[LearningStep]
    compatibility_score: int


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


class JobMatchEntry(BaseModel):
    role: str
    match_percent: int
    reasoning: str
    key_skills_matched: List[str]
    missing_skills: List[str]


class JobMatchResponse(BaseModel):
    matches: List[JobMatchEntry]
    top_role: str


class RoadmapStep(BaseModel):
    step: int
    title: str
    description: str
    duration: str
    resources: List[str]
    status: str = "pending"


class RoadmapResponse(BaseModel):
    current_position: str
    target_career: str
    steps: List[RoadmapStep]
    estimated_time: str
    twin_success_probability: float


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


class CodingEvalRequest(BaseModel):
    problem: str
    solution: str
    language: str = "python"


class CodingEvalResponse(BaseModel):
    score: int
    feedback: str
    time_complexity: str
    space_complexity: str
    improvements: List[str]
    is_correct: bool
