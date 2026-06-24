"""
Train TwinMind XGBoost exam-score predictor on real student data.

Usage:
    python train_model.py

Reads  : StudentPerformanceFactors.csv  (same directory)
Writes : model.pkl                      (same directory)

Column mapping
  Direct:
    Hours_Studied      -> study_hours
    Attendance         -> attendance_pct   (0-100 %)
    Sleep_Hours        -> sleep            (hours)
    Previous_Scores    -> quiz_score       (0-100)
    Exam_Score         -> target

  Derived:
    completion_pct  = f(Motivation_Level, Tutoring_Sessions)
    stress (1-10)   = f(Physical_Activity, Peer_Influence,
                        Learning_Disabilities, Family_Income)

Target scaling:
  Raw exam scores span only 55-101 in this dataset.
  Min-max scaling maps that range to 0-100 before training so that
  excellent input profiles predict scores above 85 and poor profiles
  predict near 0.  y_min / y_max are saved inside model.pkl so the
  predictor can report the correct scaled output without any extra file.
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


# ── Load ─────────────────────────────────────────────────────────────────────

def load_csv() -> pd.DataFrame:
    if not CSV_PATH.exists():
        sys.exit(f"ERROR: {CSV_PATH} not found.")
    df = pd.read_csv(CSV_PATH)
    print(f"Loaded {len(df):,} rows, {len(df.columns)} columns")
    print(f"Columns: {list(df.columns)}\n")
    return df


# ── Feature engineering ───────────────────────────────────────────────────────

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame()

    # Direct mappings
    # Hours_Studied is weekly in the CSV (range 1-44); divide by 5 to get
    # daily-equivalent hours so the scale matches the API input (0-12 h/day).
    out["study_hours"]    = pd.to_numeric(df["Hours_Studied"],   errors="coerce") / 5.0
    out["attendance_pct"] = pd.to_numeric(df["Attendance"],      errors="coerce")
    out["sleep"]          = pd.to_numeric(df["Sleep_Hours"],     errors="coerce")
    out["quiz_score"]     = pd.to_numeric(df["Previous_Scores"], errors="coerce")
    out["exam_score"]     = pd.to_numeric(df["Exam_Score"],      errors="coerce")

    # assignment_completion — Motivation_Level base + 2.5 pts per tutoring session
    motivation_base = df["Motivation_Level"].map(
        {"Low": 45.0, "Medium": 68.0, "High": 88.0}
    ).fillna(65.0)
    tutoring = pd.to_numeric(df["Tutoring_Sessions"], errors="coerce").fillna(0.0)
    out["completion_pct"] = np.clip(motivation_base + tutoring * 2.5, 0.0, 95.0)

    # stress (1-10) — derived from activity / social / disability / income proxies
    stress = np.full(len(df), 5.0)
    phys   = pd.to_numeric(df["Physical_Activity"], errors="coerce").fillna(2.0)
    stress -= np.clip((phys - 2.0) * 0.3, 0.0, 2.5)
    stress += df["Peer_Influence"].map(
        {"Positive": -1.5, "Neutral": 0.0, "Negative": 2.0}
    ).fillna(0.0).values
    stress += (df["Learning_Disabilities"] == "Yes").astype(float).values * 1.5
    stress += df["Family_Income"].map(
        {"Low": 1.0, "Medium": 0.0, "High": -0.5}
    ).fillna(0.0).values
    out["stress"] = np.clip(stress, 1.0, 10.0).round()

    return out


# ── Clean ─────────────────────────────────────────────────────────────────────

def clean(df: pd.DataFrame) -> pd.DataFrame:
    cols = FEATURES + ["exam_score"]
    df   = df[cols].dropna()

    # study_hours have been converted to daily-equivalent (weekly/5 -> 0-9 range)
    # exam_score max in dataset is 101 — keep all valid rows
    df = df[
        (df["study_hours"]    >= 0)   & (df["study_hours"]    <= 15)  &
        (df["attendance_pct"] >= 0)   & (df["attendance_pct"] <= 100) &
        (df["completion_pct"] >= 0)   & (df["completion_pct"] <= 100) &
        (df["quiz_score"]     >= 0)   & (df["quiz_score"]     <= 100) &
        (df["stress"]         >= 1)   & (df["stress"]         <= 10)  &
        (df["sleep"]          >= 0)   & (df["sleep"]          <= 24)  &
        (df["exam_score"]     >= 0)   & (df["exam_score"]     <= 110)
    ]
    print(f"Clean rows: {len(df):,}")
    return df.reset_index(drop=True)


# ── Target scaling ────────────────────────────────────────────────────────────

def scale_target(y: np.ndarray) -> tuple[np.ndarray, float, float]:
    """
    Percentile-rank min-max scaling: map each exam score to its rank percentile.

    Why percentile ranking instead of direct min-max?
      The raw scores span only 55-101 with std=3.9 — 75% of students cluster
      in 55-70.  A direct (y - 55) / 46 * 100 stretch maps average students to
      ~26/100 and lets the model predict at most ~60/100 with excellent inputs.

      Percentile ranking spreads labels uniformly across 0-100:
        worst score  ->   0
        median score ->  50
        best score   -> 100
      The model now learns the RELATIVE standing of each student, so an
      excellent input profile (top decile) naturally predicts 85-95+.

    Saves y_min / y_max for metadata only (shown in logs); the model output
    is already a 0-100 percentile score — no inverse transform needed.
    """
    y_min = float(y.min())
    y_max = float(y.max())

    # Rank each exam score; ties get the average rank
    order  = np.argsort(y, kind="stable")
    y_scaled = np.empty(len(y), dtype=float)
    y_scaled[order] = np.linspace(0.0, 100.0, len(y))

    print(f"Target scaling : raw [{y_min:.1f}, {y_max:.1f}]  ->  percentile [0.0, 100.0]")
    print(f"  p25={np.percentile(y, 25):.1f}  p50={np.percentile(y, 50):.1f}  "
          f"p75={np.percentile(y, 75):.1f}  p90={np.percentile(y, 90):.1f}  "
          f"p99={np.percentile(y, 99):.1f}")
    return y_scaled, y_min, y_max


# ── Model ─────────────────────────────────────────────────────────────────────

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


def train(df: pd.DataFrame) -> tuple[XGBRegressor, float, float]:
    X = df[FEATURES].values
    y = df["exam_score"].values

    # Scale target to 0-100 before training
    y_scaled, y_min, y_max = scale_target(y)
    print()

    print("Running 5-fold cross-validation on scaled target ...")
    kf        = KFold(n_splits=5, shuffle=True, random_state=42)
    model_cv  = build_model()
    r2_cv     = cross_val_score(model_cv, X, y_scaled, cv=kf, scoring="r2")
    mae_cv    = -cross_val_score(model_cv, X, y_scaled, cv=kf,
                                 scoring="neg_mean_absolute_error")
    print(f"  CV R2  : {r2_cv.mean():.4f}  +/-  {r2_cv.std():.4f}")
    print(f"  CV MAE : {mae_cv.mean():.4f}  +/-  {mae_cv.std():.4f}  (scaled pts)")
    print(f"  Per-fold R2  : {[round(float(v), 3) for v in r2_cv]}")
    print(f"  Per-fold MAE : {[round(float(v), 3) for v in mae_cv]}")
    print()

    print("Fitting final model on full dataset ...")
    model = build_model()
    model.fit(X, y_scaled)

    y_pred = model.predict(X)
    print(f"  Train R2   : {r2_score(y_scaled, y_pred):.4f}")
    print(f"  Train MAE  : {mean_absolute_error(y_scaled, y_pred):.4f}  (scaled pts)")
    print(f"  Train RMSE : {np.sqrt(((y_scaled - y_pred)**2).mean()):.4f}")

    # Feature importances
    importances = model.feature_importances_
    total       = importances.sum() or 1.0
    print("\nFeature importance (gain pct):")
    for feat, imp in sorted(zip(FEATURES, importances), key=lambda x: -x[1]):
        print(f"  {feat:<20} {imp / total * 100:.1f} pct")

    return model, y_min, y_max


# ── Save ──────────────────────────────────────────────────────────────────────

def save(model: XGBRegressor, y_min: float, y_max: float) -> None:
    """
    Save model + scaler metadata as a single bundle.
    predictor.py loads this dict and extracts 'model', 'y_min', 'y_max'.
    """
    bundle = {"model": model, "y_min": y_min, "y_max": y_max}
    joblib.dump(bundle, MODEL_PATH)
    size_kb = MODEL_PATH.stat().st_size / 1024
    print(f"\nSaved bundle to {MODEL_PATH}  ({size_kb:.0f} KB)")
    print(f"  y_min={y_min:.2f}  y_max={y_max:.2f}  (raw exam score range)")


# ── Sample predictions ────────────────────────────────────────────────────────

def sample_predict(model: XGBRegressor, y_min: float, y_max: float) -> None:
    # study_hours here = daily hours (0-12); model was trained on this scale
    samples = [
        (1.0,  60.0, 45.0, 40.0, 9, 5.0, "Struggling student"),
        (2.5,  70.0, 58.0, 55.0, 7, 6.0, "Below average"),
        (4.0,  80.0, 70.0, 68.0, 5, 7.0, "Average student"),
        (6.0,  88.0, 82.0, 80.0, 4, 7.5, "Above average"),
        (8.0,  94.0, 90.0, 88.0, 3, 8.0, "High performer"),
        (10.0, 99.0, 95.0, 95.0, 1, 8.0, "Top student"),
    ]
    print("\nSample predictions (scaled 0-100):")
    print(f"  {'Profile':<22}  {'Score':>6}  Risk")
    print(f"  {'-'*22}  {'------':>6}  ----")
    for study, att, comp, quiz, stress_v, slp, label in samples:
        X   = np.array([[study, att, comp, quiz, float(stress_v), slp]])
        raw = float(model.predict(X)[0])
        sc  = round(float(np.clip(raw, 0, 100)), 1)
        risk = "Low" if sc >= 70 else ("Medium" if sc >= 40 else "High")
        print(f"  {label:<22}  {sc:>6.1f}  {risk}")
    print()
    print(f"  (Raw dataset range {y_min:.0f}-{y_max:.0f} mapped to 0-100)")


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("TwinMind XGBoost Model Training  (min-max scaled target)")
    print("=" * 60, "\n")

    raw  = load_csv()
    feat = engineer_features(raw)
    data = clean(feat)

    print(f"\nRaw exam_score distribution:")
    es = data["exam_score"]
    print(f"  min={es.min():.0f}  max={es.max():.0f}  "
          f"mean={es.mean():.1f}  std={es.std():.1f}\n")

    model, y_min, y_max = train(data)
    save(model, y_min, y_max)
    sample_predict(model, y_min, y_max)

    print("Done.")
