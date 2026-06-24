"""
Train TwinMind XGBoost exam-score predictor on real student data.

Usage:
    python train_model.py

Reads  : StudentPerformanceFactors.csv  (same directory)
Writes : model.pkl                      (same directory)

Column mapping
  Direct:
    Hours_Studied      → study_hours
    Attendance         → attendance_pct   (0–100 %)
    Sleep_Hours        → sleep            (hours)
    Previous_Scores    → quiz_score       (0–100)
    Exam_Score         → target

  Derived:
    completion_pct  = f(Motivation_Level, Tutoring_Sessions)
    stress (1–10)   = f(Physical_Activity, Peer_Influence,
                        Learning_Disabilities, Family_Income)
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from xgboost import XGBRegressor
from sklearn.model_selection import cross_val_score, KFold
from sklearn.metrics import mean_absolute_error, r2_score

HERE = Path(__file__).parent
CSV_PATH   = HERE / "StudentPerformanceFactors.csv"
MODEL_PATH = HERE / "model.pkl"

# Internal feature order — must match predictor.py FEATURES
FEATURES = ["study_hours", "attendance_pct", "completion_pct", "quiz_score", "stress", "sleep"]


# ── Load ────────────────────────────────────────────────────────────────────

def load_csv() -> pd.DataFrame:
    if not CSV_PATH.exists():
        sys.exit(f"ERROR: {CSV_PATH} not found.")
    df = pd.read_csv(CSV_PATH)
    print(f"Loaded {len(df):,} rows, {len(df.columns)} columns")
    print(f"Columns: {list(df.columns)}\n")
    return df


# ── Feature engineering ─────────────────────────────────────────────────────

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame()

    # Direct mappings
    out["study_hours"]    = pd.to_numeric(df["Hours_Studied"],   errors="coerce")
    out["attendance_pct"] = pd.to_numeric(df["Attendance"],      errors="coerce")
    out["sleep"]          = pd.to_numeric(df["Sleep_Hours"],     errors="coerce")
    out["quiz_score"]     = pd.to_numeric(df["Previous_Scores"], errors="coerce")
    out["exam_score"]     = pd.to_numeric(df["Exam_Score"],      errors="coerce")

    # assignment_completion — derived from Motivation_Level + Tutoring_Sessions
    motivation_base = df["Motivation_Level"].map({"Low": 45.0, "Medium": 68.0, "High": 88.0}).fillna(65.0)
    tutoring        = pd.to_numeric(df["Tutoring_Sessions"], errors="coerce").fillna(0.0)
    out["completion_pct"] = np.clip(motivation_base + tutoring * 2.5, 0.0, 95.0)

    # stress (1–10) — derived from activity, social, disability, income proxies
    stress = np.full(len(df), 5.0)

    phys = pd.to_numeric(df["Physical_Activity"], errors="coerce").fillna(2.0)
    stress -= np.clip((phys - 2.0) * 0.3, 0.0, 2.5)           # more activity → less stress

    peer = df["Peer_Influence"].map({"Positive": -1.5, "Neutral": 0.0, "Negative": 2.0}).fillna(0.0)
    stress += peer.values

    stress += (df["Learning_Disabilities"] == "Yes").astype(float).values * 1.5

    income = df["Family_Income"].map({"Low": 1.0, "Medium": 0.0, "High": -0.5}).fillna(0.0)
    stress += income.values

    out["stress"] = np.clip(stress, 1.0, 10.0).round()

    return out


# ── Clean ───────────────────────────────────────────────────────────────────

def clean(df: pd.DataFrame) -> pd.DataFrame:
    cols = FEATURES + ["exam_score"]
    df = df[cols].dropna()

    # Clamp to valid ranges
    df = df[
        (df["study_hours"]    >= 0)  & (df["study_hours"]    <= 24) &
        (df["attendance_pct"] >= 0)  & (df["attendance_pct"] <= 100) &
        (df["completion_pct"] >= 0)  & (df["completion_pct"] <= 100) &
        (df["quiz_score"]     >= 0)  & (df["quiz_score"]     <= 100) &
        (df["stress"]         >= 1)  & (df["stress"]         <= 10) &
        (df["sleep"]          >= 0)  & (df["sleep"]          <= 24) &
        (df["exam_score"]     >= 0)  & (df["exam_score"]     <= 100)
    ]
    print(f"Clean rows: {len(df):,}")
    return df.reset_index(drop=True)


# ── Train ───────────────────────────────────────────────────────────────────

def build_model() -> XGBRegressor:
    return XGBRegressor(
        n_estimators=500,
        max_depth=5,
        learning_rate=0.04,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=3,
        reg_alpha=0.10,
        reg_lambda=1.0,
        random_state=42,
        verbosity=0,
        eval_metric="rmse",
        feature_names=FEATURES,
    )


def train(df: pd.DataFrame) -> XGBRegressor:
    X = df[FEATURES].values
    y = df["exam_score"].values

    print("Running 5-fold cross-validation …")
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    model_cv = build_model()
    r2_cv  = cross_val_score(model_cv, X, y, cv=kf, scoring="r2")
    mae_cv = -cross_val_score(model_cv, X, y, cv=kf, scoring="neg_mean_absolute_error")
    print(f"  CV R²  : {r2_cv.mean():.4f}  ±  {r2_cv.std():.4f}  (per fold: {r2_cv.round(4).tolist()})")
    print(f"  CV MAE : {mae_cv.mean():.4f}  ±  {mae_cv.std():.4f}")
    print()

    print("Fitting final model on full dataset …")
    model = build_model()
    model.fit(X, y)

    y_pred = model.predict(X)
    print(f"  Train R²  : {r2_score(y, y_pred):.4f}")
    print(f"  Train MAE : {mean_absolute_error(y, y_pred):.4f}")

    # Feature importances
    importances = model.feature_importances_
    total = importances.sum() or 1.0
    print("\nFeature importance (gain %):")
    for feat, imp in sorted(zip(FEATURES, importances), key=lambda x: -x[1]):
        print(f"  {feat:<20} {imp / total * 100:.1f} pct")

    return model


# ── Save ────────────────────────────────────────────────────────────────────

def save(model: XGBRegressor) -> None:
    joblib.dump(model, MODEL_PATH)
    print(f"\nModel saved to {MODEL_PATH}")


# ── Sample prediction ────────────────────────────────────────────────────────

def sample_predict(model: XGBRegressor) -> None:
    samples = [
        {"study_hours": 6.0, "attendance_pct": 85.0, "completion_pct": 75.0,
         "quiz_score": 72.0, "stress": 5.0, "sleep": 7.5,  "label": "average student"},
        {"study_hours": 9.0, "attendance_pct": 95.0, "completion_pct": 90.0,
         "quiz_score": 88.0, "stress": 3.0, "sleep": 8.0,  "label": "high performer"},
        {"study_hours": 2.0, "attendance_pct": 60.0, "completion_pct": 45.0,
         "quiz_score": 40.0, "stress": 8.0, "sleep": 5.5,  "label": "struggling student"},
    ]
    print("\nSample predictions:")
    for s in samples:
        X = np.array([[s["study_hours"], s["attendance_pct"], s["completion_pct"],
                        s["quiz_score"], s["stress"], s["sleep"]]])
        pred = float(model.predict(X)[0])
        print(f"  {s['label']:<22}  →  {pred:.1f} / 100")


# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("TwinMind XGBoost Model Training")
    print("=" * 60, "\n")

    raw  = load_csv()
    feat = engineer_features(raw)
    data = clean(feat)

    print(f"\nFeature statistics:")
    print(data[FEATURES + ["exam_score"]].describe().round(2).to_string())
    print()

    model = train(data)
    save(model)
    sample_predict(model)

    print("\nDone.")
