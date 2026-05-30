from fastapi import APIRouter, Depends

from app.models.user import User
from app.api.routes.auth import get_current_user
from app.api.schemas.prediction import PredictionRequest, PredictionResponse
from app.ml.predictor import predict

router = APIRouter(prefix="/predict", tags=["prediction"])


@router.post("", response_model=PredictionResponse)
def predict_exam_score(
    payload: PredictionRequest,
    current_user: User = Depends(get_current_user),
):
    result = predict(
        study_hours=payload.study_hours,
        attendance_percentage=payload.attendance_percentage,
        assignment_completion_rate=payload.assignment_completion_rate,
        quiz_scores=payload.quiz_scores,
        stress_level=payload.stress_level,
        sleep_duration=payload.sleep_duration,
    )
    return PredictionResponse(**result)
