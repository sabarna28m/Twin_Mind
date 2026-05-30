from fastapi import APIRouter, Depends

from app.models.user import User
from app.api.routes.auth import get_current_user
from app.api.schemas.simulate import SimulateRequest, SimulateResponse, PredictionDetail
from app.ml.predictor import predict

router = APIRouter(prefix="/simulate", tags=["simulation"])


def _run(p) -> PredictionDetail:
    result = predict(
        study_hours=p.study_hours,
        attendance_percentage=p.attendance_percentage,
        assignment_completion_rate=p.assignment_completion_rate,
        quiz_scores=p.quiz_scores,
        stress_level=p.stress_level,
        sleep_duration=p.sleep_duration,
    )
    return PredictionDetail(**result)


@router.post("", response_model=SimulateResponse)
def run_simulation(
    payload: SimulateRequest,
    current_user: User = Depends(get_current_user),
):
    curr = _run(payload.current)
    hypo = _run(payload.hypothetical)

    delta = round(hypo.predicted_score - curr.predicted_score, 1)
    improvement_pct = round((delta / curr.predicted_score) * 100, 1) if curr.predicted_score > 0 else 0.0

    return SimulateResponse(
        current=curr,
        hypothetical=hypo,
        delta=delta,
        improvement_pct=improvement_pct,
        is_improvement=delta > 0,
    )
