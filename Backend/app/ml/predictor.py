"""
Exam score predictor.
Trains a GradientBoostingRegressor on synthetic data that encodes realistic
academic performance correlations, then persists the pipeline via joblib.
The model is trained once on first import if no saved model is found.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Tuple

import numpy as np
import joblib
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent / "model.joblib"
FEATURES = ["study_hours", "attendance_pct", "completion_pct", "quiz_score", "stress", "sleep"]
N_TRAIN = 3000
RANDOM_STATE = 42


def _sleep_quality(sleep: np.ndarray) -> np.ndarray:
    """Parabolic quality curve — peaks at 7.5 h, drops off either side."""
    return np.clip(100 - np.abs(sleep - 7.5) * 13, 0, 100)


def _generate_training_data() -> Tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(RANDOM_STATE)

    study   = rng.uniform(0, 12, N_TRAIN)
    attend  = rng.uniform(40, 100, N_TRAIN)
    complet = rng.uniform(30, 100, N_TRAIN)
    quiz    = rng.uniform(20, 100, N_TRAIN)
    stress  = rng.integers(1, 11, N_TRAIN).astype(float)
    sleep   = rng.uniform(3, 10, N_TRAIN)

    study_score  = np.clip(study / 8.0, 0, 1) * 100
    stress_score = (10 - stress) / 9.0 * 100
    sleep_score  = _sleep_quality(sleep)

    exam = (
        0.30 * study_score  +
        0.20 * attend       +
        0.20 * complet      +
        0.15 * quiz         +
        0.10 * sleep_score  +
        0.05 * stress_score +
        rng.normal(0, 4, N_TRAIN)
    )
    exam = np.clip(exam, 0, 100)

    X = np.column_stack([study, attend, complet, quiz, stress, sleep])
    return X, exam


def _build_pipeline() -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),
        ("gbr", GradientBoostingRegressor(
            n_estimators=300,
            max_depth=4,
            learning_rate=0.08,
            subsample=0.85,
            random_state=RANDOM_STATE,
        )),
    ])


def _train_and_save() -> Pipeline:
    logger.info("Training exam-score prediction model…")
    X, y = _generate_training_data()
    model = _build_pipeline()
    model.fit(X, y)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    logger.info("Model trained and saved to %s", MODEL_PATH)
    return model


# ── Singleton ──────────────────────────────────────────────────────────────
_model: Pipeline | None = None


def get_model() -> Pipeline:
    global _model
    if _model is None:
        if MODEL_PATH.exists():
            logger.info("Loading saved model from %s", MODEL_PATH)
            _model = joblib.load(MODEL_PATH)
        else:
            _model = _train_and_save()
    return _model


# ── Public prediction interface ────────────────────────────────────────────

def predict(
    study_hours: float,
    attendance_percentage: float,
    assignment_completion_rate: float,
    quiz_scores: float | None,
    stress_level: int,
    sleep_duration: float,
) -> dict:
    """Return predicted exam score, risk level, and recommendations."""
    model = get_model()

    # Impute missing quiz score from correlated features
    if quiz_scores is None:
        quiz_scores = float(np.clip(
            attendance_percentage * 0.4 + assignment_completion_rate * 0.4 +
            (study_hours / 8.0) * 20,
            0, 100,
        ))
        quiz_imputed = True
    else:
        quiz_imputed = False

    X = np.array([[
        study_hours, attendance_percentage, assignment_completion_rate,
        quiz_scores, float(stress_level), sleep_duration,
    ]])

    raw = float(model.predict(X)[0])
    score = round(float(np.clip(raw, 0, 100)), 1)

    # ± uncertainty: ±8 pts (rough empirical estimate for GBR on this data)
    margin = 8.0
    conf_low  = round(max(0.0,   score - margin), 1)
    conf_high = round(min(100.0, score + margin), 1)

    # Risk level
    if score >= 70:
        risk_level, risk_label = "low",    "Low risk — on track for a good result"
    elif score >= 50:
        risk_level, risk_label = "medium", "Moderate risk — some areas need attention"
    else:
        risk_level, risk_label = "high",   "High risk — significant improvement needed"

    # Per-feature contributions (rough relative weights × normalised inputs)
    study_norm  = min(study_hours / 8.0, 1.0)
    sleep_norm  = float(np.clip(100 - abs(sleep_duration - 7.5) * 13, 0, 100)) / 100
    stress_norm = (10 - stress_level) / 9.0
    contributions = {
        "study_hours":            round(study_norm  * 30, 1),
        "attendance":             round(attendance_percentage / 100 * 20, 1),
        "assignment_completion":  round(assignment_completion_rate / 100 * 20, 1),
        "quiz_scores":            round(quiz_scores / 100 * 15, 1),
        "sleep":                  round(sleep_norm  * 10, 1),
        "stress":                 round(stress_norm *  5, 1),
    }

    # Personalised recommendations
    recs: list[str] = []
    if study_hours < 3:
        recs.append("Increase daily study time to at least 4–5 hours to improve retention.")
    elif study_hours < 5:
        recs.append("Try to push study sessions to 5–6 hours for better exam readiness.")

    if attendance_percentage < 75:
        recs.append("Attend at least 80% of classes — attendance strongly correlates with outcomes.")
    elif attendance_percentage < 85:
        recs.append("Aim for 90%+ attendance to maximise your in-class learning.")

    if assignment_completion_rate < 70:
        recs.append("Complete more assignments — they reinforce concepts tested in exams.")
    elif assignment_completion_rate < 85:
        recs.append("Close the gap on outstanding assignments before the exam.")

    if not quiz_imputed and quiz_scores < 50:
        recs.append("Quiz scores are low — revisit those topics with active recall practice.")
    elif not quiz_imputed and quiz_scores < 65:
        recs.append("Review quiz topics more thoroughly; practice with past papers.")

    if stress_level >= 8:
        recs.append("Your stress level is very high — try scheduled breaks, exercise, or mindfulness.")
    elif stress_level >= 6:
        recs.append("Moderate stress detected — maintain a consistent sleep schedule and take regular breaks.")

    if sleep_duration < 6:
        recs.append("Sleep deprivation significantly impairs memory consolidation — aim for 7–8 hours.")
    elif sleep_duration > 9:
        recs.append("Excessive sleep can signal burnout — a consistent 7–8 hours is optimal.")
    elif abs(sleep_duration - 7.5) > 1:
        recs.append("Try to keep sleep between 7 and 8 hours for peak cognitive performance.")

    if not recs:
        recs.append("Excellent habits across all dimensions — keep up the great work!")

    return {
        "predicted_score": score,
        "risk_level": risk_level,
        "risk_label": risk_label,
        "confidence_range": [conf_low, conf_high],
        "recommendations": recs,
        "feature_contributions": contributions,
    }
