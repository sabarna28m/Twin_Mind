from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.user import User
from app.models.event import Event, EventType, Priority, EventStatus
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/events", tags=["events"])

class EventCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    event_type: EventType
    priority: Priority
    status: EventStatus
    reminder_minutes_before: int = -1

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    event_type: Optional[EventType] = None
    priority: Optional[Priority] = None
    status: Optional[EventStatus] = None
    reminder_minutes_before: Optional[int] = None

class EventResponse(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str]
    start_time: datetime
    end_time: datetime
    event_type: EventType
    priority: Priority
    status: EventStatus
    reminder_minutes_before: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

@router.post("/create", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    event_in: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if event_in.start_time >= event_in.end_time:
        raise HTTPException(status_code=400, detail="Start time must be before end time")
        
    db_event = Event(
        user_id=current_user.id,
        title=event_in.title,
        description=event_in.description,
        start_time=event_in.start_time,
        end_time=event_in.end_time,
        event_type=event_in.event_type.value,
        priority=event_in.priority.value,
        status=event_in.status.value,
        reminder_minutes_before=event_in.reminder_minutes_before
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

@router.get("/user/{user_id}", response_model=List[EventResponse])
def get_user_events(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view these events")
        
    events = db.query(Event).filter(Event.user_id == current_user.id).all()
    return events

@router.put("/update/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    event_in: EventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_event = db.query(Event).filter(Event.id == event_id, Event.user_id == current_user.id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    update_data = event_in.dict(exclude_unset=True)
    
    # Validation if dates are being updated
    if 'start_time' in update_data or 'end_time' in update_data:
        new_start = update_data.get('start_time', db_event.start_time)
        new_end = update_data.get('end_time', db_event.end_time)
        if new_start >= new_end:
            raise HTTPException(status_code=400, detail="Start time must be before end time")
            
    for key, value in update_data.items():
        if isinstance(value, (EventType, Priority, EventStatus)):
            setattr(db_event, key, value.value)
        else:
            setattr(db_event, key, value)
            
    # Reset notification sent if dates or reminder changes
    if 'start_time' in update_data or 'reminder_minutes_before' in update_data:
        db_event.notification_sent = False
        db_event.last_notified_at = None
            
    db.commit()
    db.refresh(db_event)
    return db_event

@router.delete("/delete/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_event = db.query(Event).filter(Event.id == event_id, Event.user_id == current_user.id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    db.delete(db_event)
    db.commit()
    return None
