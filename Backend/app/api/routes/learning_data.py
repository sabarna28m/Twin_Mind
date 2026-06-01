from datetime import date as DateType
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import exc
from sqlalchemy.orm import Session as DBSession

from app.core.database import get_db
from app.models.learning_data import LearningData
from app.models.user import User
from app.api.routes.auth import get_current_user
from app.api.schemas.learning_data import LearningDataCreate, LearningDataUpdate, LearningDataResponse
from app.api.routes.websocket import manager
from app.services.notifications import maybe_notify_streak

router = APIRouter(prefix="/learning-data", tags=["learning-data"])


@router.get("", response_model=List[LearningDataResponse])
def list_learning_data(
    limit: Optional[int] = Query(default=60, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    return (
        db.query(LearningData)
        .filter(LearningData.user_id == current_user.id)
        .order_by(LearningData.date.desc())
        .limit(limit)
        .all()
    )


@router.get("/date/{entry_date}", response_model=LearningDataResponse)
def get_by_date(
    entry_date: DateType,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    entry = db.query(LearningData).filter(
        LearningData.user_id == current_user.id,
        LearningData.date == entry_date,
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No entry for this date")
    return entry


@router.post("", response_model=LearningDataResponse, status_code=status.HTTP_201_CREATED)
def create_learning_data(
    payload: LearningDataCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    entry = LearningData(user_id=current_user.id, **payload.model_dump())
    db.add(entry)
    try:
        db.commit()
    except exc.IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An entry for this date already exists — use PUT to update it",
        )
    db.refresh(entry)
    all_entries = db.query(LearningData).filter(LearningData.user_id == current_user.id).all()
    maybe_notify_streak(db, current_user.id, all_entries)
    background_tasks.add_task(
        manager.broadcast,
        current_user.id,
        {"type": "checkin_update", "user_id": current_user.id},
    )
    return entry


@router.put("/{entry_id}", response_model=LearningDataResponse)
def update_learning_data(
    entry_id: int,
    payload: LearningDataUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    entry = db.query(LearningData).filter(
        LearningData.id == entry_id,
        LearningData.user_id == current_user.id,
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    all_entries = db.query(LearningData).filter(LearningData.user_id == current_user.id).all()
    maybe_notify_streak(db, current_user.id, all_entries)
    background_tasks.add_task(
        manager.broadcast,
        current_user.id,
        {"type": "checkin_update", "user_id": current_user.id},
    )
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_learning_data(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    entry = db.query(LearningData).filter(
        LearningData.id == entry_id,
        LearningData.user_id == current_user.id,
    ).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    db.delete(entry)
    db.commit()
