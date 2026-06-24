"""
Exam score predictor — XGBoost edition.

Model loading priority:
  1. Backend/model.pkl  (trained by train_model.py on real student data)
  2. Re-trains from Backend/StudentPerformanceFactors.csv if pkl missing
  3. Falls back to synthetic data if CSV is also missing

Feature order (must stay stable — model was trained on this exact order):
  study_hours, attendance_pct, completion_pct, quiz_score, stress, sleep
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Tuple

import numpy as np
import joblib
from xgboost import XGBRegressor

logger = logging.getLogger(__name__)

# Backend/model.pkl — produced by train_model.py
_BACKEND_ROOT = Path(__file__).parent.parent.parent   # Backend/
MODEL_PATH = _BACKEND_ROOT / "model.pkl"
CSV_PATH   = _BACKEND_ROOT / "StudentPerformanceFactors.csv"

# Internal feature order — must match train_model.py FEATURES
FEATURES = ["study_hours", "attendance_pct", "completion_pct", "quiz_score", "stress", "sleep"]

# Public keys returned in API responses (match frontend FEATURE_LABELS)
FEATURE_KEYS = ["study_hours", "attendance", "assignment_completion", "quiz_scores", "stress", "sleep"]

RANDOM_STATE = 42

# Scaler state — populated by get_model(); model.pkl stores y_min / y_max
# so the scaled output (0-100) is the final score — no inverse transform needed.
_y_min: float | None = None
_y_max: float | None = None


# ── Real-data training (mirrors train_model.py logic) ─────────────────────

def _train_from_csv() -> XGBRegressor:
    import pandas as pd
    global _y_min, _y_max

    logger.info("Training XGBoost on real data from %s", CSV_PATH)
    df = pd.read_csv(CSV_PATH)

    out = pd.DataFrame()
    # Hours_Studied is weekly in CSV; divide by 5 to match API's daily-hour scale
    out["study_hours"]    = pd.to_numeric(df["Hours_Studied"],   errors="coerce") / 5.0
    out["attendance_pct"] = pd.to_numeric(df["Attendance"],      errors="coerce")
    out["sleep"]          = pd.to_numeric(df["Sleep_Hours"],     errors="coerce")
    out["quiz_score"]     = pd.to_numeric(df["Previous_Scores"], errors="coerce")
    out["exam_score"]     = pd.to_numeric(df["Exam_Score"],      errors="coerce")

    motivation_base = df["Motivation_Level"].map({"Low": 45.0, "Medium": 68.0, "High": 88.0}).fillna(65.0)
    tutoring        = pd.to_numeric(df["Tutoring_Sessions"], errors="coerce").fillna(0.0)
    out["completion_pct"] = np.clip(motivation_base + tutoring * 2.5, 0.0, 95.0)

    stress = np.full(len(df), 5.0)
    phys   = pd.to_numeric(df["Physical_Activity"], errors="coerce").fillna(2.0)
    stress -= np.clip((phys - 2.0) * 0.3, 0.0, 2.5)
    stress += df["Peer_Influence"].map({"Positive": -1.5, "Neutral": 0.0, "Negative": 2.0}).fillna(0.0).values
    stress += (df["Learning_Disabilities"] == "Yes").astype(float).values * 1.5
    stress += df["Family_Income"].map({"Low": 1.0, "Medium": 0.0, "High": -0.5}).fillna(0.0).values
    out["stress"] = np.clip(stress, 1.0, 10.0).round()

    out = out[FEATURES + ["exam_score"]].dropna()
    X   = out[FEATURES].values
    y   = out["exam_score"].values

    # Percentile-rank scaling to 0-100 (uniform label distribution)
    _y_min = float(y.min())
    _y_max = float(y.max())
    order    = np.argsort(y, kind="stable")
    y_scaled = np.empty(len(y), dtype=float)
    y_scaled[order] = np.linspace(0.0, 100.0, len(y))

    model = _build_model()
    model.fit(X, y_scaled)

    bundle = {"model": model, "y_min": _y_min, "y_max": _y_max}
    joblib.dump(bundle, MODEL_PATH)
    logger.info("Model trained on %d rows (scaled %.1f-%.1f -> 0-100), saved to %s",
                len(out), _y_min, _y_max, MODEL_PATH)
    return model


# ── Synthetic fallback (kept for environments without the CSV) ─────────────

def _sleep_quality(sleep: np.ndarray) -> np.ndarray:
    return np.clip(100 - np.abs(sleep - 7.5) * 13, 0, 100)


def _generate_synthetic_data() -> Tuple[np.ndarray, np.ndarray]:
    rng     = np.random.default_rng(RANDOM_STATE)
    n       = 5000
    study   = rng.uniform(0, 12, n)
    attend  = rng.uniform(40, 100, n)
    complet = rng.uniform(30, 100, n)
    quiz    = rng.uniform(20, 100, n)
    stress  = rng.integers(1, 11, n).astype(float)
    sleep   = rng.uniform(3, 10, n)

    exam = np.clip(
        0.30 * np.clip(study / 8.0, 0, 1) * 100 +
        0.20 * attend +
        0.20 * complet +
        0.15 * quiz +
        0.10 * _sleep_quality(sleep) +
        0.05 * ((10 - stress) / 9.0 * 100) +
        rng.normal(0, 4, n),
        0, 100,
    )
    return np.column_stack([study, attend, complet, quiz, stress, sleep]), exam


def _train_synthetic() -> XGBRegressor:
    global _y_min, _y_max
    logger.warning("CSV not found — training on synthetic data (lower accuracy).")
    X, y = _generate_synthetic_data()

    # Synthetic data is already 0-100; still store scaler metadata for consistency
    _y_min = float(y.min())
    _y_max = float(y.max())

    model = _build_model()
    model.fit(X, y)
    bundle = {"model": model, "y_min": _y_min, "y_max": _y_max}
    joblib.dump(bundle, MODEL_PATH)
    logger.info("Synthetic model saved to %s", MODEL_PATH)
    return model


# ── Model construction ─────────────────────────────────────────────────────

def _build_model() -> XGBRegressor:
    return XGBRegressor(
        n_estimators=500,
        max_depth=5,
        learning_rate=0.04,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=3,
        reg_alpha=0.10,
        reg_lambda=1.0,
        random_state=RANDOM_STATE,
        verbosity=0,
        eval_metric="rmse",
        feature_names=FEATURES,
    )


# ── Singleton ──────────────────────────────────────────────────────────────
_model: XGBRegressor | None = None


def get_model() -> XGBRegressor:
    global _model, _y_min, _y_max
    if _model is not None:
        return _model

    if MODEL_PATH.exists():
        try:
            loaded = joblib.load(MODEL_PATH)
            # Accept both bundle dict (new format) and bare XGBRegressor (legacy)
            if isinstance(loaded, dict) and "model" in loaded:
                _model = loaded["model"]
                _y_min = loaded.get("y_min")
                _y_max = loaded.get("y_max")
                logger.info("Loaded model bundle from %s  (y_min=%.1f, y_max=%.1f)",
                            MODEL_PATH, _y_min or 0, _y_max or 100)
                return _model
            elif isinstance(loaded, XGBRegressor):
                logger.info("Loaded legacy model from %s — no scaler metadata", MODEL_PATH)
                _model = loaded
                return _model
            logger.warning("Unrecognised model.pkl format — retraining.")
        except Exception as exc:
            logger.warning("Failed to load model.pkl (%s) — retraining.", exc)
        MODEL_PATH.unlink(missing_ok=True)

    if CSV_PATH.exists():
        _model = _train_from_csv()
    else:
        _model = _train_synthetic()
    return _model


# ── Feature importance ─────────────────────────────────────────────────────

def _get_feature_importance(model: XGBRegressor) -> dict[str, float]:
    raw   = model.feature_importances_
    total = raw.sum() or 1.0
    pct   = (raw / total * 100).round(1)
    raw_d = {key: round(float(pct[i]), 1) for i, key in enumerate(FEATURE_KEYS)}
    return dict(sorted(raw_d.items(), key=lambda kv: kv[1], reverse=True))


# ── Public prediction interface ────────────────────────────────────────────

def predict(
    study_hours: float,
    attendance_percentage: float,
    assignment_completion_rate: float,
    quiz_scores: float | None,
    stress_level: int,
    sleep_duration: float,
) -> dict:
    """Return predicted exam score, risk level, recommendations, and feature importances."""
    model = get_model()

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

    raw   = float(model.predict(X)[0])
    score = round(float(np.clip(raw, 0, 100)), 1)

    margin    = 5.0
    conf_low  = round(max(0.0,   score - margin), 1)
    conf_high = round(min(100.0, score + margin), 1)

    # Percentile-scale thresholds: top 35% = low, next 35% = medium, bottom 30% = high
    if score >= 65:
        risk_level, risk_label = "low",    "Low risk — on track for a good result"
    elif score >= 30:
        risk_level, risk_label = "medium", "Moderate risk — some areas need attention"
    else:
        risk_level, risk_label = "high",   "High risk — significant improvement needed"

    feature_importance = _get_feature_importance(model)

    study_norm  = min(study_hours / 8.0, 1.0)
    sleep_norm  = float(np.clip(100 - abs(sleep_duration - 7.5) * 13, 0, 100)) / 100
    stress_norm = (10 - stress_level) / 9.0
    feature_contributions = {
        "study_hours":           round(study_norm  * 30, 1),
        "attendance":            round(attendance_percentage / 100 * 20, 1),
        "assignment_completion": round(assignment_completion_rate / 100 * 20, 1),
        "quiz_scores":           round(quiz_scores / 100 * 15, 1),
        "sleep":                 round(sleep_norm  * 10, 1),
        "stress":                round(stress_norm *  5, 1),
    }

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
        "predicted_score":       score,
        "risk_level":            risk_level,
        "risk_label":            risk_label,
        "confidence_range":      [conf_low, conf_high],
        "recommendations":       recs,
        "feature_contributions": feature_contributions,
        "feature_importance":    feature_importance,
    }
