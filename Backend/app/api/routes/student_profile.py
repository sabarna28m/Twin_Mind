from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.models.student_profile import StudentProfile
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.api.schemas.student_profile import StudentProfileCreate, StudentProfileUpdate, StudentProfileResponse

router = APIRouter(prefix="/student-profile", tags=["student-profile"])


@router.get("", response_model=StudentProfileResponse)
def get_student_profile(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
    return profile


@router.post("", response_model=StudentProfileResponse, status_code=status.HTTP_201_CREATED)
def create_student_profile(
    payload: StudentProfileCreate,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Profile already exists — use PUT to update")
    profile = StudentProfile(
        user_id=current_user.id,
        institution=payload.institution,
        course=payload.course,
        semester=payload.semester,
        academic_goals=payload.academic_goals or "",
        learning_preferences=payload.learning_preferences or "",
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.put("", response_model=StudentProfileResponse)
def update_student_profile(
    payload: StudentProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found — use POST to create")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile
