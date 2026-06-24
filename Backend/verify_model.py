import sys, pathlib, datetime
sys.path.insert(0, '.')

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import r2_score, mean_absolute_error
from sklearn.model_selection import cross_val_score, KFold

print("=" * 58)
print("1. model.pkl FILE CHECK")
print("=" * 58)
p = pathlib.Path("model.pkl")
if not p.exists():
    print("  NOT FOUND"); sys.exit(1)
size_kb = p.stat().st_size / 1024
mtime   = datetime.datetime.fromtimestamp(p.stat().st_mtime)
print(f"  EXISTS  : Backend/model.pkl")
print(f"  Size    : {size_kb:.1f} KB")
print(f"  Modified: {mtime:%Y-%m-%d %H:%M:%S}")

print()
print("=" * 58)
print("2. MODEL INFO")
print("=" * 58)
bundle = joblib.load("model.pkl")
model  = bundle["model"]
y_min  = bundle.get("y_min", 0)
y_max  = bundle.get("y_max", 100)
print(f"  Type         : {type(model).__name__}")
print(f"  n_estimators : {model.n_estimators}")
print(f"  max_depth    : {model.max_depth}")
print(f"  learning_rate: {model.learning_rate}")
print(f"  y_min/y_max  : {y_min:.1f} / {y_max:.1f}  (original CSV range)")
print(f"  Scaling      : percentile-rank -> [0, 100]")

print()
print("=" * 58)
print("3. ACCURACY ON REAL DATA")
print("=" * 58)
FEATURES = ["study_hours", "attendance_pct", "completion_pct", "quiz_score", "stress", "sleep"]

df = pd.read_csv("StudentPerformanceFactors.csv")
print(f"  CSV rows : {len(df):,}")

out = pd.DataFrame()
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

out  = out[FEATURES + ["exam_score"]].dropna()
X    = out[FEATURES].values
y_raw = out["exam_score"].values

# Reconstruct percentile targets (same as training)
order    = np.argsort(y_raw, kind="stable")
y_scaled = np.empty(len(y_raw), dtype=float)
y_scaled[order] = np.linspace(0.0, 100.0, len(y_raw))

print(f"  Clean rows : {len(out):,}")
y_pred = model.predict(X)

print()
print("  -- Full-data metrics (on percentile-scaled target) --")
print(f"  Train R2   : {r2_score(y_scaled, y_pred):.4f}")
print(f"  Train MAE  : {mean_absolute_error(y_scaled, y_pred):.2f} percentile pts")
print(f"  Train RMSE : {np.sqrt(((y_scaled - y_pred)**2).mean()):.2f} percentile pts")

print()
print("  -- 5-fold Cross-Validation --")
kf     = KFold(n_splits=5, shuffle=True, random_state=42)
r2_cv  = cross_val_score(model, X, y_scaled, cv=kf, scoring="r2")
mae_cv = -cross_val_score(model, X, y_scaled, cv=kf, scoring="neg_mean_absolute_error")
print(f"  CV R2  : {r2_cv.mean():.4f}  std={r2_cv.std():.4f}")
print(f"  CV MAE : {mae_cv.mean():.2f}  std={mae_cv.std():.4f}  percentile pts")
print(f"  Per-fold R2  : {[round(float(v),3) for v in r2_cv]}")

print()
print("=" * 58)
print("4. FEATURE IMPORTANCE (gain %)")
print("=" * 58)
FEATURE_KEYS = ["study_hours", "attendance", "assignment_completion", "quiz_scores", "stress", "sleep"]
importances  = model.feature_importances_
total        = importances.sum()
for feat, imp in sorted(zip(FEATURE_KEYS, importances), key=lambda x: -x[1]):
    bar = "#" * int(imp / total * 40)
    print(f"  {feat:<25} {imp/total*100:5.1f}%  {bar}")

print()
print("=" * 58)
print("5. SAMPLE PREDICTIONS")
print("   (study_hours = daily hours; dataset mean=3.6h/day)")
print("=" * 58)

# Inputs calibrated against dataset feature distributions:
#   study_hours: dataset mean=3.6h/day, std=0.9  (weekly/5)
#   attendance : dataset mean=80%, std=11.6
#   completion : dataset mean=69%, std=15.4
#   quiz_score : dataset mean=74.9, std=14.4
#   stress     : dataset mean=4.95, std=1.57
#   sleep      : dataset mean=7.0, std=1.46
samples = [
    (1.0, 63.0, 47.0, 52.0, 8, 5.5, "Failing student      "),
    (2.0, 70.0, 55.0, 60.0, 7, 6.0, "Struggling student   "),
    (3.6, 80.0, 69.0, 75.0, 5, 7.0, "Average student      "),
    (5.0, 87.0, 80.0, 82.0, 4, 7.5, "Above-average student"),
    (7.0, 94.0, 88.0, 90.0, 3, 8.0, "High performer       "),
    (9.0, 99.0, 95.0, 96.0, 1, 8.0, "Top student          "),
]
print(f"  {'Profile':<25}  {'Score':>6}  {'Risk':<8}  Interpretation")
print(f"  {'-'*25}  {'------':>6}  {'----':<8}  --------------")
for study, att, comp, quiz, stress_v, slp, label in samples:
    X_s  = np.array([[study, att, comp, quiz, float(stress_v), slp]])
    raw  = float(model.predict(X_s)[0])
    sc   = round(float(np.clip(raw, 0, 100)), 1)
    risk = "Low" if sc >= 70 else ("Medium" if sc >= 40 else "High")
    pct_label = (
        "Top 5%"   if sc >= 95 else
        "Top 15%"  if sc >= 85 else
        "Top 30%"  if sc >= 70 else
        "Middle"   if sc >= 40 else
        "Bottom 40%" if sc >= 20 else
        "Bottom 10%"
    )
    print(f"  {label}  {sc:>6.1f}  {risk:<8}  {pct_label}")

print()
print("=" * 58)
print("6. TARGET DISTRIBUTION IN DATASET")
print("=" * 58)
print(f"  Raw exam_score  :  min={y_raw.min():.0f}  max={y_raw.max():.0f}  "
      f"mean={y_raw.mean():.1f}  std={y_raw.std():.1f}")
print(f"  Scaled (pct)    :  min=0.0  max=100.0  "
      f"mean={y_scaled.mean():.1f}  std={y_scaled.std():.1f}")
print(f"  Scores >= 70 pct: {(y_pred>=70).sum():,}  ({(y_pred>=70).mean()*100:.1f}% predicted)")
print(f"  Scores >= 85 pct: {(y_pred>=85).sum():,}  ({(y_pred>=85).mean()*100:.1f}% predicted)")
