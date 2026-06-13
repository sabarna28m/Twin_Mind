import json
import random
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from groq import Groq

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.comm_twin import CommTwin
from app.api.routes.auth import get_current_user
from app.api.schemas.comm_twin import (
    CommTwinResponse, CommTwinPrediction,
    SpeechAnalysisRequest, SpeechAnalysisResponse,
    GrammarError, FillerWordCount,
    ImageChallenge, ImageChallengeEvalRequest, ImageChallengeEvalResponse,
    SpeakingTask,
    DailyVocabResponse, VocabWord,
    GrammarCorrectionRequest, GrammarCorrectionResponse,
    InterviewCommRequest, InterviewCommResponse,
    AiCoachResponse, DailyPracticeActivity,
)

router = APIRouter(prefix="/comm", tags=["communication"])
GROQ_MODEL = "llama-3.3-70b-versatile"
_client: Optional[Groq] = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        if not settings.groq_api_key:
            raise HTTPException(503, "AI service not configured.")
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
            temperature=0.35,
            max_tokens=max_tokens,
        )
        text = resp.choices[0].message.content.strip()
        for sc, ec in [("{", "}"), ("[", "]")]:
            s = text.find(sc); e = text.rfind(ec) + 1
            if s >= 0 and e > 0:
                return json.loads(text[s:e])
    except Exception:
        pass
    return None


# ── Communication Twin DB helpers ──────────────────────────────────────────

def _get_or_create(user_id: int, db: DBSession) -> CommTwin:
    t = db.query(CommTwin).filter_by(user_id=user_id).first()
    if not t:
        t = CommTwin(user_id=user_id)
        db.add(t); db.commit(); db.refresh(t)
    return t


def _weighted_update(existing: float, new_val: float, sessions: int) -> float:
    if sessions < 5:
        w = 0.5
    elif sessions < 15:
        w = 0.35
    else:
        w = 0.25
    return round(existing * (1 - w) + new_val * w, 1)


def _update_comm_twin(
    user_id: int, db: DBSession,
    fluency: Optional[float] = None,
    pronunciation: Optional[float] = None,
    vocabulary: Optional[float] = None,
    grammar: Optional[float] = None,
    confidence: Optional[float] = None,
    interview_comm: Optional[float] = None,
    event: str = "activity",
    words_reviewed_delta: int = 0,
    activity_entry: Optional[dict] = None,
) -> CommTwin:
    t = _get_or_create(user_id, db)
    t.sessions_count += 1

    n = t.sessions_count
    if fluency      is not None: t.fluency_score        = _weighted_update(t.fluency_score,        fluency,       n)
    if pronunciation is not None: t.pronunciation_score  = _weighted_update(t.pronunciation_score,  pronunciation, n)
    if vocabulary   is not None: t.vocabulary_score     = _weighted_update(t.vocabulary_score,     vocabulary,    n)
    if grammar      is not None: t.grammar_score        = _weighted_update(t.grammar_score,        grammar,       n)
    if confidence   is not None: t.confidence_score     = _weighted_update(t.confidence_score,     confidence,    n)
    if interview_comm is not None: t.interview_comm_score = _weighted_update(t.interview_comm_score, interview_comm, n)

    t.words_reviewed += words_reviewed_delta

    active_scores = [s for s in [t.fluency_score, t.vocabulary_score, t.grammar_score, t.confidence_score] if s > 0]
    t.overall_score = round(_safe_avg(active_scores), 1)

    # Score history
    history = json.loads(t.score_history_json or "[]")
    history.append({
        "date":    date.today().isoformat(),
        "event":   event,
        "overall": round(t.overall_score, 1),
        "fluency": round(t.fluency_score, 1),
        "grammar": round(t.grammar_score, 1),
        "vocab":   round(t.vocabulary_score, 1),
        "confidence": round(t.confidence_score, 1),
    })
    t.score_history_json = json.dumps(history[-90:])

    # Activity log
    if activity_entry:
        log = json.loads(t.activity_log_json or "[]")
        log.insert(0, activity_entry)
        t.activity_log_json = json.dumps(log[:20])

    db.commit(); db.refresh(t)
    return t


def _level_label(score: float) -> str:
    if score >= 85: return "Advanced"
    if score >= 70: return "Upper Intermediate"
    if score >= 55: return "Intermediate"
    if score >= 35: return "Beginner"
    return "Getting Started"


# ── Curated image challenges ───────────────────────────────────────────────

IMAGE_CHALLENGES = [
    {"challenge_id":1,"topic":"forest path","image_url":"https://picsum.photos/seed/forest1/800/500","context":"A winding path through a dense green forest, sunlight filtering through tall trees","expected":["trees","path","forest","green","sunlight","leaves","shadows","nature"],"story_prompt":"What journey does this path lead to?","difficulty":"Easy"},
    {"challenge_id":2,"topic":"mountain lake","image_url":"https://picsum.photos/seed/mountain2/800/500","context":"A calm mountain lake reflecting snow-capped peaks, clear blue sky, pine trees on the shore","expected":["mountain","lake","water","reflection","snow","sky","trees","peaceful"],"story_prompt":"Who lives near this serene lake and what is their story?","difficulty":"Easy"},
    {"challenge_id":3,"topic":"city street at night","image_url":"https://picsum.photos/seed/city3/800/500","context":"A busy city street at night, neon lights, people walking, cars passing, tall buildings","expected":["city","night","lights","people","buildings","street","cars","busy"],"story_prompt":"What secrets does this city street hold at midnight?","difficulty":"Medium"},
    {"challenge_id":4,"topic":"beach sunset","image_url":"https://picsum.photos/seed/beach4/800/500","context":"A beautiful sunset over the ocean, orange and pink sky, waves on sandy beach, silhouettes","expected":["sunset","ocean","beach","sky","waves","sand","colors","peaceful"],"story_prompt":"Who is watching this sunset and what are they thinking?","difficulty":"Easy"},
    {"challenge_id":5,"topic":"farmer in a field","image_url":"https://picsum.photos/seed/farm5/800/500","context":"An elderly farmer working in a golden wheat field at harvest time, clear sky, distant barn","expected":["farmer","field","crops","work","harvest","sky","rural","labor"],"story_prompt":"What has this farmer's life journey been like?","difficulty":"Medium"},
    {"challenge_id":6,"topic":"children playing","image_url":"https://picsum.photos/seed/children6/800/500","context":"Children playing in a colorful playground, laughing, running, swings and slides visible","expected":["children","playing","playground","fun","colorful","joy","running","school"],"story_prompt":"What game are these children inventing?","difficulty":"Easy"},
    {"challenge_id":7,"topic":"old library","image_url":"https://picsum.photos/seed/library7/800/500","context":"An old magnificent library with tall bookshelves, wooden ladders, warm lighting, a reader","expected":["books","library","shelves","knowledge","reading","old","wooden","quiet"],"story_prompt":"What rare book is hidden in this library?","difficulty":"Medium"},
    {"challenge_id":8,"topic":"rain in the city","image_url":"https://picsum.photos/seed/rain8/800/500","context":"Rainy day in a city, people with umbrellas, wet streets reflecting lights, grey sky","expected":["rain","umbrellas","wet","city","reflections","grey","walking","weather"],"story_prompt":"Where is each person with an umbrella hurrying to?","difficulty":"Medium"},
    {"challenge_id":9,"topic":"scientist in lab","image_url":"https://picsum.photos/seed/science9/800/500","context":"A scientist in a white lab coat working with equipment, microscopes, test tubes, focused","expected":["scientist","laboratory","equipment","research","microscope","experiment","focused","discovery"],"story_prompt":"What breakthrough is this scientist on the verge of discovering?","difficulty":"Hard"},
    {"challenge_id":10,"topic":"busy marketplace","image_url":"https://picsum.photos/seed/market10/800/500","context":"A vibrant outdoor marketplace, colorful stalls, vendors, crowds, fresh produce and goods","expected":["market","vendors","crowd","colorful","stalls","products","busy","culture"],"story_prompt":"What is the most valuable thing being sold in this market today?","difficulty":"Hard"},
]

# ── Speaking tasks library ─────────────────────────────────────────────────

SPEAKING_TASKS = {
    "concept": [
        {"prompt":"Explain Artificial Intelligence", "sub":"Describe what AI is, how it works, and give real-world examples.", "difficulty":"Medium"},
        {"prompt":"Explain Climate Change", "sub":"Describe the causes, effects, and what individuals can do.", "difficulty":"Medium"},
        {"prompt":"Explain Machine Learning", "sub":"What is machine learning, and how does it differ from traditional programming?", "difficulty":"Hard"},
        {"prompt":"Explain Blockchain", "sub":"What is blockchain technology and why does it matter?", "difficulty":"Hard"},
        {"prompt":"Explain the Internet", "sub":"How does the internet work? Explain it simply.", "difficulty":"Easy"},
        {"prompt":"Explain Data Science", "sub":"What do data scientists do and why is it an important field?", "difficulty":"Medium"},
    ],
    "discussion": [
        {"prompt":"Should AI replace human teachers?", "sub":"Share your opinion with 3 supporting arguments.", "difficulty":"Medium"},
        {"prompt":"Is social media beneficial or harmful to society?", "sub":"Take a clear stance and defend it.", "difficulty":"Easy"},
        {"prompt":"Should coding be a mandatory school subject?", "sub":"Argue for or against this with examples.", "difficulty":"Medium"},
        {"prompt":"Is remote work better than office work?", "sub":"Compare both with specific examples from your perspective.", "difficulty":"Easy"},
        {"prompt":"Will robots take most jobs by 2040?", "sub":"Analyze the future of work in the AI era.", "difficulty":"Hard"},
        {"prompt":"Is a college degree still necessary for success?", "sub":"Discuss with specific evidence.", "difficulty":"Medium"},
    ],
    "intro": [
        {"prompt":"Personal Introduction (30 seconds)", "sub":"Tell me about yourself — background, interests, and goals in 30 seconds.", "difficulty":"Easy"},
        {"prompt":"Professional Introduction (60 seconds)", "sub":"Introduce yourself as if speaking to a recruiter at a career fair.", "difficulty":"Medium"},
        {"prompt":"Elevator Pitch — Your Best Skill", "sub":"In 60 seconds, pitch your strongest skill to a hiring manager.", "difficulty":"Hard"},
        {"prompt":"Why Should We Hire You?", "sub":"Answer this classic interview question confidently.", "difficulty":"Hard"},
    ],
    "story": [
        {"prompt":"A time you overcame a challenge", "sub":"Tell a real or imaginary story about overcoming a difficult situation.", "difficulty":"Medium"},
        {"prompt":"Your greatest learning moment", "sub":"Describe an experience that taught you something important.", "difficulty":"Easy"},
        {"prompt":"A day in the life of a future AI engineer", "sub":"Narrate an imaginary day in your dream career.", "difficulty":"Medium"},
        {"prompt":"The most interesting person you have met", "sub":"Describe this person and why they inspired you.", "difficulty":"Easy"},
    ],
}

# ── Filler word detection ──────────────────────────────────────────────────

FILLER_WORDS = ["um", "uh", "umm", "uhh", "like", "you know", "basically", "actually",
                "literally", "kind of", "sort of", "I mean", "right", "so yeah",
                "well", "anyway", "you see", "okay so", "ah", "er"]


def _count_fillers(text: str) -> tuple[list[dict], int]:
    lower = text.lower()
    counts: dict[str, int] = {}
    for fw in FILLER_WORDS:
        cnt = lower.count(f" {fw} ") + lower.count(f" {fw},") + lower.count(f" {fw}.")
        if cnt > 0:
            counts[fw] = cnt
    total = sum(counts.values())
    return [{"word": w, "count": c} for w, c in sorted(counts.items(), key=lambda x: -x[1])], total


ADVANCED_VOCAB = [
    "consequently","nevertheless","furthermore","substantial","demonstrate",
    "significant","comprehensive","analyze","evaluate","perspective","fundamental",
    "proficient","innovative","strategically","implement","leverage","optimize",
    "collaborate","facilitate","articulate","endeavor","exemplify","encompass",
    "synthesize","paramount","sophisticated","meticulous","eloquent","cognizant",
]


def _detect_advanced_vocab(text: str) -> list[str]:
    lower = text.lower()
    return [w for w in ADVANCED_VOCAB if w in lower]


# ── Core speech analysis ───────────────────────────────────────────────────

def _analyze_speech(transcript: str, activity_type: str, context: str) -> dict:
    words = transcript.split()
    sentences = [s.strip() for s in transcript.replace("!", ".").replace("?", ".").split(".") if s.strip()]
    wc = len(words)
    sc = len(sentences) if sentences else 1
    avg_sl = round(wc / sc, 1)

    filler_list, filler_count = _count_fillers(transcript)
    advanced_words = _detect_advanced_vocab(transcript)

    fluency_raw = max(0, min(100, 100 - (filler_count / max(wc, 1) * 500) - (10 if wc < 30 else 0) + (5 if avg_sl > 10 else 0)))

    prompt = f"""You are an expert English communication coach. Analyze this spoken response.

ACTIVITY TYPE: {activity_type}
CONTEXT/TOPIC: {context or 'General speaking task'}
TRANSCRIPT: "{transcript}"

DETECTED STATS:
- Word count: {wc}
- Filler words: {filler_count} ({[f['word'] for f in filler_list[:5]]})
- Advanced vocabulary used: {advanced_words}
- Average sentence length: {avg_sl} words

Respond ONLY with valid JSON:
{{
  "grammar_score": <0-100>,
  "vocabulary_score": <0-100>,
  "confidence_score": <0-100>,
  "pronunciation_score": <0-100>,
  "vocabulary_level": "<Beginner|Intermediate|Advanced>",
  "confidence_level": "<Low|Medium|High|Very High>",
  "corrected_text": "<full corrected version of transcript>",
  "grammar_errors": [
    {{"original":"<phrase>","corrected":"<fixed>","rule":"<grammar rule>","explanation":"<why>"}}
  ],
  "fluency_feedback": "<1-2 sentences on fluency>",
  "vocabulary_feedback": "<1-2 sentences on vocabulary>",
  "confidence_feedback": "<1-2 sentences on confidence>",
  "pronunciation_tips": ["tip1","tip2","tip3"],
  "strengths": ["s1","s2","s3"],
  "weaknesses": ["w1","w2"],
  "improvement_tips": ["tip1","tip2","tip3"],
  "practice_suggestion": "<specific daily practice suggestion>"
}}"""

    data = _groq_json(prompt, max_tokens=1400) or {}

    grammar_score  = int(data.get("grammar_score",  60))
    vocab_score    = int(data.get("vocabulary_score", 60))
    conf_score     = int(data.get("confidence_score", 55))
    pronun_score   = int(data.get("pronunciation_score", 60))
    fluency_score  = int(min(100, max(10, fluency_raw + (vocab_score - 60) * 0.1)))

    overall = round((fluency_score * 0.20 + grammar_score * 0.25 +
                     vocab_score * 0.20 + conf_score * 0.20 + pronun_score * 0.15))

    grammar_errors = [
        GrammarError(**e) for e in data.get("grammar_errors", [])
        if isinstance(e, dict) and all(k in e for k in ["original","corrected","rule","explanation"])
    ]

    return {
        "fluency_score":        fluency_score,
        "pronunciation_score":  pronun_score,
        "vocabulary_score":     vocab_score,
        "grammar_score":        grammar_score,
        "confidence_score":     conf_score,
        "overall_score":        overall,
        "corrected_text":       data.get("corrected_text", transcript),
        "grammar_errors":       grammar_errors,
        "grammar_error_count":  len(grammar_errors),
        "filler_words":         [FillerWordCount(**f) for f in filler_list],
        "filler_word_count":    filler_count,
        "word_count":           wc,
        "sentence_count":       sc,
        "avg_sentence_length":  avg_sl,
        "fluency_feedback":     data.get("fluency_feedback", ""),
        "advanced_words_used":  advanced_words,
        "vocabulary_level":     data.get("vocabulary_level", "Intermediate"),
        "vocabulary_feedback":  data.get("vocabulary_feedback", ""),
        "confidence_level":     data.get("confidence_level", "Medium"),
        "confidence_feedback":  data.get("confidence_feedback", ""),
        "pronunciation_tips":   data.get("pronunciation_tips", []),
        "strengths":            data.get("strengths", []),
        "weaknesses":           data.get("weaknesses", []),
        "improvement_tips":     data.get("improvement_tips", []),
        "practice_suggestion":  data.get("practice_suggestion", ""),
    }


# ── 1. Communication Twin State ────────────────────────────────────────────

@router.get("/twin", response_model=CommTwinResponse)
def get_comm_twin(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    t = _get_or_create(current_user.id, db)
    history = json.loads(t.score_history_json or "[]")

    # Growth calculations
    today = date.today()
    week_ago = (today - timedelta(days=7)).isoformat()
    month_ago = (today - timedelta(days=30)).isoformat()

    week_pts  = [h["overall"] for h in history if h["date"] >= week_ago]
    month_pts = [h["overall"] for h in history if h["date"] >= month_ago]
    weekly_growth  = round(max(week_pts,  default=0) - min(week_pts,  default=0), 1) if len(week_pts)  >= 2 else 0.0
    monthly_growth = round(max(month_pts, default=0) - min(month_pts, default=0), 1) if len(month_pts) >= 2 else 0.0

    # Predictions
    slope = (weekly_growth / 7) if weekly_growth else max(0.3, (100 - t.overall_score) * 0.015)
    def _pred(days: int) -> CommTwinPrediction:
        gain   = slope * days
        ov     = min(99, round(t.overall_score + gain))
        fl     = min(99, round(t.fluency_score + gain * 0.9))
        conf   = min(99, round(t.confidence_score + gain * 0.8))
        vocab  = min(99, round(t.vocabulary_score + gain * 0.7))
        interv = min(99, round(t.interview_comm_score + gain * 0.6))
        return CommTwinPrediction(
            days=days, overall_score=ov, fluency=fl,
            confidence=conf, vocabulary=vocab, interview_readiness=interv,
            level_label=_level_label(ov),
            forecast=f"{'Excellent' if gain>15 else 'Steady'} growth expected — {_level_label(ov)} level in {days} days.",
        )

    # AI insight
    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role":"user","content":(
                f"Communication Twin: Overall={t.overall_score:.0f}, Fluency={t.fluency_score:.0f}, "
                f"Grammar={t.grammar_score:.0f}, Vocab={t.vocabulary_score:.0f}, "
                f"Confidence={t.confidence_score:.0f}, Sessions={t.sessions_count}. "
                "Write one specific, motivating sentence (max 30 words) predicting their English communication trajectory."
            )}],
            temperature=0.5, max_tokens=70,
        )
        insight = resp.choices[0].message.content.strip().strip('"')
    except Exception:
        insight = f"Your Communication Twin is {_level_label(t.overall_score)} — keep practicing to unlock your full potential."

    activities = json.loads(t.activity_log_json or "[]")

    return CommTwinResponse(
        overall_score=round(t.overall_score),
        fluency_score=round(t.fluency_score),
        pronunciation_score=round(t.pronunciation_score),
        vocabulary_score=round(t.vocabulary_score),
        grammar_score=round(t.grammar_score),
        confidence_score=round(t.confidence_score),
        interview_comm_score=round(t.interview_comm_score),
        sessions_count=t.sessions_count,
        words_reviewed=t.words_reviewed,
        level_label=_level_label(t.overall_score),
        weekly_growth=weekly_growth,
        monthly_growth=monthly_growth,
        predictions={"30d": _pred(30), "90d": _pred(90), "180d": _pred(180)},
        score_history=history[-30:],
        recent_activities=activities[:10],
        twin_insight=insight,
        last_updated=t.updated_at.isoformat() if t.updated_at else None,
    )


# ── 2. Analyze Speech ──────────────────────────────────────────────────────

@router.post("/analyze", response_model=SpeechAnalysisResponse)
def analyze_speech(
    payload: SpeechAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if len(payload.transcript.strip()) < 10:
        raise HTTPException(400, "Transcript too short. Please speak at least a few sentences.")

    result = _analyze_speech(payload.transcript, payload.activity_type, payload.context)

    activity_entry = {
        "date": date.today().isoformat(),
        "type": payload.activity_type,
        "snippet": payload.transcript[:80] + ("…" if len(payload.transcript) > 80 else ""),
        "overall": result["overall_score"],
        "grammar": result["grammar_score"],
        "fluency": result["fluency_score"],
    }

    _update_comm_twin(
        current_user.id, db,
        fluency=result["fluency_score"],
        pronunciation=result["pronunciation_score"],
        vocabulary=result["vocabulary_score"],
        grammar=result["grammar_score"],
        confidence=result["confidence_score"],
        event=payload.activity_type,
        activity_entry=activity_entry,
    )

    return SpeechAnalysisResponse(twin_updated=True, **result)


# ── 3. Image Challenge ─────────────────────────────────────────────────────

@router.get("/image-challenge", response_model=ImageChallenge)
def get_image_challenge(
    difficulty: str = "Easy",
    current_user: User = Depends(get_current_user),
):
    pool = [c for c in IMAGE_CHALLENGES if c["difficulty"] == difficulty]
    if not pool:
        pool = IMAGE_CHALLENGES
    chosen = random.choice(pool)
    return ImageChallenge(
        challenge_id=chosen["challenge_id"],
        image_url=chosen["image_url"],
        topic=chosen["topic"],
        task=f"Look at this image carefully and describe everything you observe about '{chosen['topic']}'. Talk about what you see, the mood, the details, and what might happen next.",
        story_prompt=chosen["story_prompt"],
        difficulty=chosen["difficulty"],
    )


@router.post("/image-challenge/evaluate", response_model=ImageChallengeEvalResponse)
def evaluate_image_challenge(
    payload: ImageChallengeEvalRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    challenge = next((c for c in IMAGE_CHALLENGES if c["challenge_id"] == payload.challenge_id), None)
    if not challenge:
        raise HTTPException(404, "Challenge not found.")

    expected = challenge.get("expected", [])
    transcript_lower = payload.transcript.lower()
    mentioned   = [e for e in expected if e in transcript_lower]
    missed      = [e for e in expected if e not in transcript_lower]
    accuracy    = round(len(mentioned) / len(expected) * 100) if expected else 50
    observation = min(100, accuracy + 10)

    speech_result = _analyze_speech(payload.transcript, "picture", challenge["context"])
    clarity       = speech_result["overall_score"]

    prompt = f"""Create a vivid text description of an image based solely on this person's spoken description:
"{payload.transcript}"

Also describe what AI-generated image would result from this description.
Respond ONLY with valid JSON:
{{
  "reconstruction_description": "<2-3 sentence visual description of what image the AI would generate>",
  "feedback": "<2 sentences: what was well-described and what important visual elements were missed>"
}}"""
    extra = _groq_json(prompt, max_tokens=400) or {}

    activity_entry = {
        "date": date.today().isoformat(), "type": "image_challenge",
        "snippet": payload.transcript[:80] + "…",
        "overall": speech_result["overall_score"],
        "accuracy": accuracy,
    }
    _update_comm_twin(current_user.id, db,
                      fluency=speech_result["fluency_score"],
                      vocabulary=speech_result["vocabulary_score"],
                      grammar=speech_result["grammar_score"],
                      confidence=speech_result["confidence_score"],
                      event="image_challenge", activity_entry=activity_entry)

    return ImageChallengeEvalResponse(
        description_accuracy=accuracy,
        observation_score=observation,
        communication_clarity=clarity,
        elements_mentioned=mentioned,
        elements_missed=missed,
        speech_analysis=SpeechAnalysisResponse(twin_updated=True, **speech_result),
        ai_reconstruction_description=extra.get("reconstruction_description", "Your description painted a vivid picture."),
        feedback=extra.get("feedback", "Good observation skills! Try to describe more specific details next time."),
        twin_updated=True,
    )


# ── 4. Speaking Task ───────────────────────────────────────────────────────

@router.get("/speaking-task", response_model=SpeakingTask)
def get_speaking_task(
    task_type: str = "discussion",
    current_user: User = Depends(get_current_user),
):
    pool = SPEAKING_TASKS.get(task_type, SPEAKING_TASKS["discussion"])
    chosen = random.choice(pool)
    tips_map = {
        "concept": ["Use simple analogies", "Give real-world examples", "Structure: definition → how it works → examples"],
        "discussion": ["State your position clearly", "Use 'I believe' / 'In my opinion'", "Support with 2-3 examples", "Acknowledge counterarguments"],
        "intro": ["Smile and make eye contact", "Speak clearly and confidently", "Use present tense", "End with enthusiasm"],
        "story": ["Set the scene first", "Use vivid adjectives", "Include emotions", "Have a clear beginning, middle, end"],
    }
    time_map = {"concept": "90 seconds", "discussion": "2 minutes", "intro": "60 seconds", "story": "2 minutes"}
    return SpeakingTask(
        task_id=f"{task_type}_{random.randint(1000,9999)}",
        task_type=task_type,
        prompt=chosen["prompt"],
        sub_prompt=chosen["sub"],
        tips=tips_map.get(task_type, []),
        time_suggestion=time_map.get(task_type, "90 seconds"),
        difficulty=chosen["difficulty"],
    )


# ── 5. Daily Vocabulary ────────────────────────────────────────────────────

@router.get("/vocabulary/daily", response_model=DailyVocabResponse)
def get_daily_vocabulary(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    today = date.today()
    day_seed = today.timetuple().tm_yday  # 1-365, ensures same words per day

    prompt = f"""Generate exactly 5 advanced English vocabulary words suitable for a university student preparing for job interviews.
Day seed: {day_seed} (use this to pick different words each day, cycling through a large vocabulary set).
Theme for today: {["Technology", "Leadership", "Communication", "Analysis", "Innovation"][day_seed % 5]}

Respond ONLY with valid JSON:
{{
  "level": "Advanced",
  "theme": "<theme name>",
  "words": [
    {{
      "word": "<word>",
      "meaning": "<clear definition>",
      "synonyms": ["syn1","syn2","syn3"],
      "antonyms": ["ant1","ant2"],
      "example_sentence": "<natural example sentence>",
      "interview_usage": "<how to use this word in an interview>",
      "professional_usage": "<how to use in professional writing/speaking>",
      "difficulty": "<Intermediate|Advanced>"
    }}
  ]
}}"""
    data = _groq_json(prompt, max_tokens=1200) or {}

    words_raw = data.get("words", [])
    words = []
    for w in words_raw:
        if isinstance(w, dict) and "word" in w:
            words.append(VocabWord(
                word=w.get("word",""),
                meaning=w.get("meaning",""),
                synonyms=w.get("synonyms",[]),
                antonyms=w.get("antonyms",[]),
                example_sentence=w.get("example_sentence",""),
                interview_usage=w.get("interview_usage",""),
                professional_usage=w.get("professional_usage",""),
                difficulty=w.get("difficulty","Advanced"),
            ))

    if not words:
        raise HTTPException(500, "Failed to generate vocabulary. Please try again.")

    # Track words reviewed
    _update_comm_twin(current_user.id, db,
                      vocabulary=min(100, max(50, current_user.id % 30 + 60)),
                      event="vocabulary", words_reviewed_delta=len(words))

    return DailyVocabResponse(
        words=words, date=today.isoformat(),
        level=data.get("level", "Advanced"),
        theme=data.get("theme", "General"),
    )


# ── 6. Grammar Correction ──────────────────────────────────────────────────

@router.post("/grammar/correct", response_model=GrammarCorrectionResponse)
def correct_grammar(
    payload: GrammarCorrectionRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    prompt = f"""You are an expert English grammar teacher. Analyze and correct this text.

TEXT: "{payload.text}"

Respond ONLY with valid JSON:
{{
  "corrected_text": "<fully corrected text>",
  "score": <0-100>,
  "grade": "<A/B/C/D>",
  "summary": "<1-2 sentence overall assessment>",
  "errors": [
    {{"original":"<phrase>","corrected":"<fixed>","rule":"<grammar rule name>","explanation":"<why it's wrong>"}}
  ]
}}"""
    data = _groq_json(prompt, max_tokens=900) or {}
    errors = [
        GrammarError(**e) for e in data.get("errors", [])
        if isinstance(e, dict) and all(k in e for k in ["original","corrected","rule","explanation"])
    ]
    score = int(data.get("score", 65))
    grade = data.get("grade", "C")

    _update_comm_twin(current_user.id, db, grammar=float(score),
                      event="grammar_correction",
                      activity_entry={"date":date.today().isoformat(),"type":"grammar","overall":score})

    return GrammarCorrectionResponse(
        original_text=payload.text,
        corrected_text=data.get("corrected_text", payload.text),
        errors=errors, score=score, grade=grade,
        summary=data.get("summary", ""),
        twin_updated=True,
    )


# ── 7. Interview Communication Mode ───────────────────────────────────────

@router.get("/interview/question")
def get_interview_question(
    question_type: str = "hr",
    current_user: User = Depends(get_current_user),
):
    HR_QUESTIONS = [
        "Tell me about yourself.", "Why do you want this position?",
        "What is your greatest strength?", "Describe a challenge you overcame.",
        "Where do you see yourself in 5 years?", "Why should we hire you?",
        "What motivates you?", "Tell me about a time you worked in a team.",
    ]
    TECH_QUESTIONS = [
        "Explain your most complex project.", "How do you stay updated with technology?",
        "Describe your problem-solving approach.", "What programming languages do you know?",
        "Tell me about a technical challenge you solved.", "How do you handle debugging complex issues?",
    ]
    BEHAVIORAL = [
        "Give an example of when you showed leadership.",
        "Describe a situation where you had to meet a tight deadline.",
        "Tell me about a time you disagreed with a team member.",
        "Give an example of when you received critical feedback.",
        "Describe a time you went above and beyond.",
    ]
    pool = {"hr": HR_QUESTIONS, "technical": TECH_QUESTIONS, "behavioral": BEHAVIORAL}.get(question_type, HR_QUESTIONS)
    return {"question": random.choice(pool), "question_type": question_type,
            "tips": ["Take 2 seconds to organize your thoughts", "Use the STAR method for behavioral questions",
                     "Be specific with examples", "Speak for 60-90 seconds"]}


@router.post("/interview/evaluate", response_model=InterviewCommResponse)
def evaluate_interview_comm(
    payload: InterviewCommRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    prompt = f"""You are an expert communication evaluator. Assess this interview response ONLY on communication quality, not content.

QUESTION: {payload.question}
RESPONSE: "{payload.transcript}"

Evaluate HOW they communicate (not what they say).
Respond ONLY with valid JSON:
{{
  "communication_score": <0-100>,
  "confidence_score": <0-100>,
  "clarity_score": <0-100>,
  "grammar_score": <0-100>,
  "professionalism_score": <0-100>,
  "overall_score": <0-100>,
  "feedback": "<3 sentence overall communication feedback>",
  "strengths": ["s1","s2","s3"],
  "improvements": ["i1","i2","i3"],
  "model_answer_hint": "<structural hint on how to answer better, focusing on communication>"
}}"""
    data = _groq_json(prompt, max_tokens=700) or {}
    overall = int(data.get("overall_score", 60))

    _update_comm_twin(current_user.id, db,
                      interview_comm=float(overall),
                      confidence=float(data.get("confidence_score", 60)),
                      grammar=float(data.get("grammar_score", 60)),
                      event="interview_comm",
                      activity_entry={"date":date.today().isoformat(),"type":"interview","overall":overall,
                                      "question":payload.question[:60]})

    return InterviewCommResponse(
        communication_score=int(data.get("communication_score", 60)),
        confidence_score=int(data.get("confidence_score", 60)),
        clarity_score=int(data.get("clarity_score", 60)),
        grammar_score=int(data.get("grammar_score", 60)),
        professionalism_score=int(data.get("professionalism_score", 60)),
        overall_score=overall,
        feedback=data.get("feedback", ""),
        strengths=data.get("strengths", []),
        improvements=data.get("improvements", []),
        model_answer_hint=data.get("model_answer_hint", ""),
        twin_updated=True,
    )


# ── 8. AI Coach ────────────────────────────────────────────────────────────

@router.get("/coach", response_model=AiCoachResponse)
def get_ai_coach(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    t = _get_or_create(current_user.id, db)
    level = _level_label(t.overall_score)

    # Identify weakest area
    scores = {
        "Fluency": t.fluency_score, "Grammar": t.grammar_score,
        "Vocabulary": t.vocabulary_score, "Confidence": t.confidence_score,
    }
    weakest = min(scores, key=lambda k: scores[k]) if any(v > 0 for v in scores.values()) else "Fluency"

    prompt = f"""You are a personal English communication coach. Create a personalized daily practice plan.

Student level: {level}
Weakest area: {weakest} ({scores.get(weakest, 0):.0f}/100)
Sessions completed: {t.sessions_count}

Respond ONLY with valid JSON:
{{
  "focus_today": "<today's specific focus area>",
  "motivational_message": "<inspiring, specific message under 25 words>",
  "weekly_goal": "<concrete, measurable weekly goal>",
  "badge_to_earn": "<achievement badge name they can earn this week>",
  "daily_plan": [
    {{"order":1,"activity":"<activity name>","duration":"<e.g. 5 min>","focus_area":"<area>","description":"<what to do specifically>"}},
    {{"order":2,"activity":"<activity name>","duration":"<e.g. 10 min>","focus_area":"<area>","description":"<what to do>"}},
    {{"order":3,"activity":"<activity name>","duration":"<e.g. 5 min>","focus_area":"<area>","description":"<what to do>"}},
    {{"order":4,"activity":"<activity name>","duration":"<e.g. 10 min>","focus_area":"<area>","description":"<what to do>"}},
    {{"order":5,"activity":"<activity name>","duration":"<e.g. 5 min>","focus_area":"<area>","description":"<what to do>"}}
  ]
}}"""
    data = _groq_json(prompt, max_tokens=900) or {}

    plan_raw = data.get("daily_plan", [])
    plan = [DailyPracticeActivity(**p) for p in plan_raw if isinstance(p, dict) and "order" in p] if plan_raw else [
        DailyPracticeActivity(order=1, activity="Mirror Speaking", duration="5 min", focus_area="Confidence",
                              description="Speak about your day in front of a mirror. Focus on eye contact and posture."),
        DailyPracticeActivity(order=2, activity="Daily Vocabulary", duration="10 min", focus_area="Vocabulary",
                              description="Study today's 5 vocabulary words and use each in a sentence."),
        DailyPracticeActivity(order=3, activity="Read Aloud", duration="10 min", focus_area="Pronunciation",
                              description="Read a news article aloud, focusing on clear pronunciation."),
        DailyPracticeActivity(order=4, activity="Speaking Task", duration="10 min", focus_area="Fluency",
                              description="Complete a speaking task on the platform and review feedback."),
        DailyPracticeActivity(order=5, activity="Grammar Review", duration="5 min", focus_area="Grammar",
                              description="Review one grammar rule and write 3 example sentences."),
    ]

    return AiCoachResponse(
        level=level,
        daily_plan=plan,
        focus_today=data.get("focus_today", weakest),
        motivational_message=data.get("motivational_message", "Every word you speak brings you closer to fluency."),
        weekly_goal=data.get("weekly_goal", f"Complete 5 speaking tasks and review all daily vocabulary."),
        badge_to_earn=data.get("badge_to_earn", "Consistent Communicator"),
    )
