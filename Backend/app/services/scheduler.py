import asyncio
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.event import Event
from app.api.routes.websocket import manager

scheduler = AsyncIOScheduler()

async def check_upcoming_events():
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        # We find events that haven't sent notifications, 
        # have a valid reminder preference (>= 0),
        # and start_time is approaching or past the reminder threshold.
        # But we only want to notify if the event hasn't started yet 
        # (or at least start_time is in the future relative to when the job checks).
        
        # Get all pending events
        pending_events = db.query(Event).filter(
            Event.notification_sent == False,
            Event.reminder_minutes_before >= 0
        ).all()
        
        for event in pending_events:
            # Calculate the notification time
            notify_time = event.start_time - timedelta(minutes=event.reminder_minutes_before)
            
            # If current time is past the notification time
            if now >= notify_time:
                # Update DB
                event.notification_sent = True
                event.last_notified_at = now
                
                # We commit immediately per event so if websocket fails, we don't spam
                db.commit()
                
                # Prepare payload
                payload = {
                    "type": "event_reminder",
                    "event_id": event.id,
                    "title": event.title,
                    "start_time": event.start_time.isoformat(),
                    "reminder_minutes_before": event.reminder_minutes_before,
                    "message": f"'{event.title}' starts in {event.reminder_minutes_before} minutes" if event.reminder_minutes_before > 0 else f"'{event.title}' is starting now!"
                }
                
                # Push via WebSockets if user is online
                await manager.broadcast(event.user_id, payload)
                
    except Exception as e:
        print(f"Scheduler error in check_upcoming_events: {e}")
    finally:
        db.close()

def start_scheduler():
    scheduler.add_job(
        check_upcoming_events,
        trigger=IntervalTrigger(minutes=1),
        id="check_upcoming_events",
        replace_existing=True,
    )
    scheduler.start()

def stop_scheduler():
    scheduler.shutdown()
