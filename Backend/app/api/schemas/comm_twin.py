from pydantic import BaseModel
from typing import List, Optional, Dict, Any


# ── Communication Twin State ────────────────────────────────────────────────

class CommTwinPrediction(BaseModel):
    days: int
    overall_score: int
    fluency: int
    confidence: int
    vocabulary: int
    interview_readiness: int
    level_label: str
    forecast: str


class CommTwinResponse(BaseModel):
    overall_score: int
    fluency_score: int
    pronunciation_score: int
    vocabulary_score: int
    grammar_score: int
    confidence_score: int
    interview_comm_score: int
    sessions_count: int
    words_reviewed: int
    level_label: str
    weekly_growth: float
    monthly_growth: float
    predictions: Dict[str, CommTwinPrediction]
    score_history: List[Dict[str, Any]]
    recent_activities: List[Dict[str, Any]]
    twin_insight: str
    last_updated: Optional[str]


# ── Speech Analysis ─────────────────────────────────────────────────────────

class SpeechAnalysisRequest(BaseModel):
    transcript: str
    activity_type: str   # "picture", "story", "concept", "discussion", "intro", "interview"
    context: str = ""    # topic or image description hint


class GrammarError(BaseModel):
    original: str
    corrected: str
    rule: str
    explanation: str


class FillerWordCount(BaseModel):
    word: str
    count: int


class SpeechAnalysisResponse(BaseModel):
    # Scores
    fluency_score: int
    pronunciation_score: int
    vocabulary_score: int
    grammar_score: int
    confidence_score: int
    overall_score: int

    # Grammar
    corrected_text: str
    grammar_errors: List[GrammarError]
    grammar_error_count: int

    # Fluency
    filler_words: List[FillerWordCount]
    filler_word_count: int
    word_count: int
    sentence_count: int
    avg_sentence_length: float
    fluency_feedback: str

    # Vocabulary
    advanced_words_used: List[str]
    vocabulary_level: str
    vocabulary_feedback: str

    # Confidence
    confidence_level: str
    confidence_feedback: str

    # Pronunciation guidance
    pronunciation_tips: List[str]

    # AI Coach
    strengths: List[str]
    weaknesses: List[str]
    improvement_tips: List[str]
    practice_suggestion: str

    twin_updated: bool = True


# ── Image Challenge ─────────────────────────────────────────────────────────

class ImageChallenge(BaseModel):
    challenge_id: int
    image_url: str
    topic: str
    task: str
    story_prompt: str
    difficulty: str


class ImageChallengeEvalRequest(BaseModel):
    challenge_id: int
    transcript: str
    image_context: str   # description of what the image shows


class ImageChallengeEvalResponse(BaseModel):
    description_accuracy: int
    observation_score: int
    communication_clarity: int
    elements_mentioned: List[str]
    elements_missed: List[str]
    speech_analysis: SpeechAnalysisResponse
    ai_reconstruction_description: str
    feedback: str
    twin_updated: bool = True


# ── Speaking Task ───────────────────────────────────────────────────────────

class SpeakingTask(BaseModel):
    task_id: str
    task_type: str      # concept|discussion|intro|story
    prompt: str
    sub_prompt: str
    tips: List[str]
    time_suggestion: str
    difficulty: str


# ── Vocabulary ──────────────────────────────────────────────────────────────

class VocabWord(BaseModel):
    word: str
    meaning: str
    synonyms: List[str]
    antonyms: List[str]
    example_sentence: str
    interview_usage: str
    professional_usage: str
    difficulty: str


class DailyVocabResponse(BaseModel):
    words: List[VocabWord]
    date: str
    level: str
    theme: str


# ── Grammar Correction ──────────────────────────────────────────────────────

class GrammarCorrectionRequest(BaseModel):
    text: str


class GrammarCorrectionResponse(BaseModel):
    original_text: str
    corrected_text: str
    errors: List[GrammarError]
    score: int
    grade: str
    summary: str
    twin_updated: bool = True


# ── Interview Communication ─────────────────────────────────────────────────

class InterviewCommRequest(BaseModel):
    transcript: str
    question: str
    question_type: str  # hr|technical|behavioral


class InterviewCommResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    communication_score: int
    confidence_score: int
    clarity_score: int
    grammar_score: int
    professionalism_score: int
    overall_score: int
    feedback: str
    strengths: List[str]
    improvements: List[str]
    model_answer_hint: str
    twin_updated: bool = True


# ── AI Coach Daily Plan ─────────────────────────────────────────────────────

class DailyPracticeActivity(BaseModel):
    order: int
    activity: str
    duration: str
    focus_area: str
    description: str


class AiCoachResponse(BaseModel):
    level: str
    daily_plan: List[DailyPracticeActivity]
    focus_today: str
    motivational_message: str
    weekly_goal: str
    badge_to_earn: str
