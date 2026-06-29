from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.core.database import engine, Base
from app.models import user  # noqa: F401
from app.models import session  # noqa: F401
from app.models import note  # noqa: F401
from app.models import material  # noqa: F401
from app.models import student_profile  # noqa: F401
from app.models import learning_data  # noqa: F401
from app.models import password_reset  # noqa: F401
from app.models import mentor_conversation  # noqa: F401
from app.models import achievement  # noqa: F401
from app.models import notification  # noqa: F401
from app.models import study_plan  # noqa: F401
from app.models import chat_session  # noqa: F401
from app.models import quiz  # noqa: F401
from app.models import weekly_challenge  # noqa: F401
from app.models import battle  # noqa: F401
from app.models import event  # noqa: F401
from app.models import burnout  # noqa: F401
from app.models import subject_performance  # noqa: F401
from app.models import smart_plan_record  # noqa: F401
from app.models import career_twin  # noqa: F401
from app.models import comm_twin  # noqa: F401
from app.models import smart_note  # noqa: F401
from app.models import note_history  # noqa: F401
from app.models import note_version  # noqa: F401
from app.models import skill_tree  # noqa: F401
from app.models import streak_shield  # noqa: F401
from app.api.routes import health, auth, sessions, notes, materials, analytics, student_profile as sp_routes, learning_data as ld_routes, prediction as pred_routes, simulate as sim_routes, mentor as mentor_routes, twin as twin_routes, achievements as ach_routes, notifications as notif_routes, quiz as quiz_routes, gamification as gamif_routes, battles as battle_routes, events as events_routes, smart_plan as smart_plan_routes
from app.api.routes import streak_protection as shield_routes
from app.api.routes import websocket as ws_routes
from app.api.routes import videos as video_routes
from app.api.routes import burnout as burnout_routes
from app.api.routes import subject_performance as subj_routes
from app.api.routes import test_image as test_image_routes
from app.api.routes import career as career_routes
from app.api.routes import comm_twin as comm_routes
from app.api.routes import smart_notes as smart_notes_routes
from app.api.routes import skill_tree as skill_tree_routes
from app.api.routes import missions as missions_routes
from app.ml.predictor import get_model  # warm up model at startup

Base.metadata.create_all(bind=engine)

# Idempotent migration — adds 2FA columns to existing users table if absent
def _run_2fa_migration() -> None:
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("""
                ALTER TABLE users
                    ADD COLUMN IF NOT EXISTS twofa_secret       TEXT,
                    ADD COLUMN IF NOT EXISTS twofa_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
                    ADD COLUMN IF NOT EXISTS twofa_backup_codes JSONB,
                    ADD COLUMN IF NOT EXISTS twofa_setup_at     TIMESTAMPTZ;
            """))
            conn.commit()
    except Exception:
        pass  # columns already exist or DB not yet available

_run_2fa_migration()

# Idempotent migration - adds new notification columns to existing events table if absent
def _run_events_migration() -> None:
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("""
                ALTER TABLE events
                    ADD COLUMN IF NOT EXISTS reminder_minutes_before INTEGER NOT NULL DEFAULT -1,
                    ADD COLUMN IF NOT EXISTS notification_sent       BOOLEAN NOT NULL DEFAULT FALSE,
                    ADD COLUMN IF NOT EXISTS last_notified_at        TIMESTAMPTZ;
            """))
            conn.commit()
    except Exception as e:
        print(f"Events migration skipped or failed (safe to ignore if table doesn't exist yet): {e}")

_run_events_migration()

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
)

from app.services.scheduler import start_scheduler, stop_scheduler

@app.on_event("startup")
async def startup_event():
    start_scheduler()

@app.on_event("shutdown")
async def shutdown_event():
    stop_scheduler()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.api_v1_prefix, tags=["health"])
app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(sessions.router, prefix=settings.api_v1_prefix)
app.include_router(notes.router, prefix=settings.api_v1_prefix)
app.include_router(materials.router, prefix=settings.api_v1_prefix)
app.include_router(analytics.router, prefix=settings.api_v1_prefix)
app.include_router(sp_routes.router, prefix=settings.api_v1_prefix)
app.include_router(ld_routes.router, prefix=settings.api_v1_prefix)
app.include_router(pred_routes.router, prefix=settings.api_v1_prefix)
app.include_router(sim_routes.router, prefix=settings.api_v1_prefix)
app.include_router(mentor_routes.router, prefix=settings.api_v1_prefix)
app.include_router(twin_routes.router, prefix=settings.api_v1_prefix)
app.include_router(ach_routes.router, prefix=settings.api_v1_prefix)
app.include_router(notif_routes.router, prefix=settings.api_v1_prefix)
app.include_router(quiz_routes.router, prefix=settings.api_v1_prefix)
app.include_router(gamif_routes.router, prefix=settings.api_v1_prefix)
app.include_router(battle_routes.router, prefix=settings.api_v1_prefix)
app.include_router(events_routes.router, prefix=settings.api_v1_prefix)
app.include_router(smart_plan_routes.router, prefix=settings.api_v1_prefix)
app.include_router(video_routes.router, prefix=settings.api_v1_prefix)
app.include_router(burnout_routes.router, prefix=settings.api_v1_prefix)
app.include_router(subj_routes.router, prefix=settings.api_v1_prefix)
app.include_router(test_image_routes.router, prefix=settings.api_v1_prefix)
app.include_router(career_routes.router, prefix=settings.api_v1_prefix)
app.include_router(comm_routes.router, prefix=settings.api_v1_prefix)
app.include_router(smart_notes_routes.router, prefix=settings.api_v1_prefix)
app.include_router(skill_tree_routes.router, prefix=settings.api_v1_prefix)
app.include_router(missions_routes.router, prefix=settings.api_v1_prefix)
app.include_router(shield_routes.router, prefix=settings.api_v1_prefix)
app.include_router(ws_routes.router)

_uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
_uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")


@app.get("/")
async def root():
    return {"message": "Welcome to TwinMind API"}
