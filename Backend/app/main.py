from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from sqlalchemy import text

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
from app.models import google_token  # noqa: F401
from app.models import burnout  # noqa: F401
from app.models import subject_performance  # noqa: F401
from app.models import smart_plan_record  # noqa: F401
from app.api.routes import health, auth, sessions, notes, materials, analytics, student_profile as sp_routes, learning_data as ld_routes, prediction as pred_routes, simulate as sim_routes, mentor as mentor_routes, twin as twin_routes, achievements as ach_routes, notifications as notif_routes, quiz as quiz_routes, gamification as gamif_routes, battles as battle_routes, calendar as calendar_routes, smart_plan as smart_plan_routes
from app.api.routes import websocket as ws_routes
from app.api.routes import videos as video_routes
from app.api.routes import burnout as burnout_routes
from app.api.routes import subject_performance as subj_routes
from app.api.routes import test_image as test_image_routes
from app.ml.predictor import get_model  # warm up model at startup

Base.metadata.create_all(bind=engine)

# Add columns to existing DBs that predate these migrations
with engine.connect() as _conn:
    for _sql in [
        "ALTER TABLE users ADD COLUMN avatar_url TEXT",
        "ALTER TABLE student_profiles ADD COLUMN subjects TEXT DEFAULT ''",
        (
            "CREATE TABLE IF NOT EXISTS notifications ("
            "id INTEGER PRIMARY KEY, "
            "user_id INTEGER NOT NULL REFERENCES users(id), "
            "notification_type VARCHAR(50) NOT NULL, "
            "message VARCHAR(500) NOT NULL, "
            "is_read BOOLEAN NOT NULL DEFAULT 0, "
            "reference_key VARCHAR(100), "
            "created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
        ),
        "CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id)",
        (
            "CREATE TABLE IF NOT EXISTS study_plans ("
            "id INTEGER PRIMARY KEY, "
            "user_id INTEGER NOT NULL REFERENCES users(id), "
            "plan_text TEXT NOT NULL, "
            "created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
        ),
        "CREATE INDEX IF NOT EXISTS ix_study_plans_user_id ON study_plans(user_id)",
        (
            "CREATE TABLE IF NOT EXISTS chat_sessions ("
            "id INTEGER PRIMARY KEY, "
            "user_id INTEGER NOT NULL REFERENCES users(id), "
            "title VARCHAR(200) NOT NULL, "
            "messages_json TEXT NOT NULL, "
            "message_count INTEGER NOT NULL DEFAULT 0, "
            "created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
        ),
        "CREATE INDEX IF NOT EXISTS ix_chat_sessions_user_id ON chat_sessions(user_id)",
        (
            "CREATE TABLE IF NOT EXISTS quiz_sessions ("
            "id INTEGER PRIMARY KEY, "
            "user_id INTEGER NOT NULL REFERENCES users(id), "
            "subject VARCHAR(200) NOT NULL, "
            "duration_minutes INTEGER NOT NULL, "
            "difficulty VARCHAR(20) NOT NULL, "
            "questions TEXT NOT NULL, "
            "answers TEXT, "
            "score INTEGER, "
            "total INTEGER, "
            "time_taken INTEGER, "
            "created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
        ),
        "CREATE INDEX IF NOT EXISTS ix_quiz_sessions_user_id ON quiz_sessions(user_id)",
        (
            "CREATE TABLE IF NOT EXISTS weekly_challenges ("
            "id INTEGER PRIMARY KEY, "
            "user_id INTEGER NOT NULL REFERENCES users(id), "
            "week_start DATE NOT NULL, "
            "target_study_hours REAL, "
            "target_quiz_count INTEGER, "
            "target_checkin_days INTEGER, "
            "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
            "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
        ),
        "CREATE INDEX IF NOT EXISTS ix_weekly_challenges_user_id ON weekly_challenges(user_id)",
        (
            "CREATE TABLE IF NOT EXISTS battles ("
            "id INTEGER PRIMARY KEY, "
            "challenger_id INTEGER NOT NULL REFERENCES users(id), "
            "opponent_id INTEGER REFERENCES users(id), "
            "battle_type VARCHAR(20) NOT NULL, "
            "target_value REAL NOT NULL, "
            "duration VARCHAR(10) NOT NULL, "
            "status VARCHAR(20) NOT NULL DEFAULT 'pending', "
            "winner_id INTEGER REFERENCES users(id), "
            "invite_code VARCHAR(20) UNIQUE NOT NULL, "
            "is_random BOOLEAN NOT NULL DEFAULT 0, "
            "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
            "expires_at DATETIME, "
            "started_at DATETIME, "
            "completed_at DATETIME)"
        ),
        "CREATE INDEX IF NOT EXISTS ix_battles_challenger_id ON battles(challenger_id)",
        "CREATE INDEX IF NOT EXISTS ix_battles_opponent_id ON battles(opponent_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_battles_invite_code ON battles(invite_code)",
        (
            "CREATE TABLE IF NOT EXISTS google_tokens ("
            "id INTEGER PRIMARY KEY, "
            "user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE, "
            "access_token TEXT NOT NULL, "
            "refresh_token TEXT, "
            "token_expiry TEXT, "
            "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
            "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
        ),
        "CREATE INDEX IF NOT EXISTS ix_google_tokens_user_id ON google_tokens(user_id)",
        (
            "CREATE TABLE IF NOT EXISTS burnout_entries ("
            "id INTEGER PRIMARY KEY, "
            "user_id INTEGER NOT NULL REFERENCES users(id), "
            "date DATE NOT NULL, "
            "study_hours REAL NOT NULL, "
            "sleep_hours REAL NOT NULL, "
            "breaks_taken INTEGER NOT NULL, "
            "study_streak_days INTEGER NOT NULL DEFAULT 0, "
            "mood_rating INTEGER NOT NULL, "
            "energy_level INTEGER NOT NULL, "
            "burnout_score INTEGER NOT NULL, "
            "risk_level VARCHAR(10) NOT NULL, "
            "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
            "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
            "UNIQUE(user_id, date))"
        ),
        "CREATE INDEX IF NOT EXISTS ix_burnout_entries_user_id ON burnout_entries(user_id)",
        (
            "CREATE TABLE IF NOT EXISTS subject_records ("
            "id INTEGER PRIMARY KEY, "
            "user_id INTEGER NOT NULL REFERENCES users(id), "
            "subject VARCHAR(100) NOT NULL, "
            "date DATE NOT NULL, "
            "score REAL NOT NULL, "
            "study_hours REAL DEFAULT 0.0, "
            "confidence INTEGER DEFAULT 3, "
            "source VARCHAR(20) DEFAULT 'manual', "
            "topics_json TEXT DEFAULT '[]', "
            "notes TEXT DEFAULT '', "
            "created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
        ),
        "CREATE INDEX IF NOT EXISTS ix_subject_records_user_id ON subject_records(user_id)",
        "CREATE INDEX IF NOT EXISTS ix_subject_records_subject ON subject_records(subject)",
        (
            "CREATE TABLE IF NOT EXISTS smart_plan_records ("
            "id INTEGER PRIMARY KEY, "
            "user_id INTEGER NOT NULL REFERENCES users(id), "
            "plan_content TEXT NOT NULL, "
            "generated_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
            "is_active BOOLEAN NOT NULL DEFAULT 1)"
        ),
        "CREATE INDEX IF NOT EXISTS ix_smart_plan_records_user_id ON smart_plan_records(user_id)",
        # AI notification fields
        "ALTER TABLE notifications ADD COLUMN priority VARCHAR(20)",
        "ALTER TABLE notifications ADD COLUMN category VARCHAR(50)",
        "ALTER TABLE notifications ADD COLUMN emoji VARCHAR(10)",
        "ALTER TABLE notifications ADD COLUMN title VARCHAR(200)",
        "ALTER TABLE notifications ADD COLUMN action_url VARCHAR(300)",
    ]:
        try:
            _conn.execute(text(_sql))
            _conn.commit()
        except Exception:
            pass  # column already exists

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
)

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
app.include_router(calendar_routes.router, prefix=settings.api_v1_prefix)
app.include_router(smart_plan_routes.router, prefix=settings.api_v1_prefix)
app.include_router(video_routes.router, prefix=settings.api_v1_prefix)
app.include_router(burnout_routes.router, prefix=settings.api_v1_prefix)
app.include_router(subj_routes.router, prefix=settings.api_v1_prefix)
app.include_router(test_image_routes.router, prefix=settings.api_v1_prefix)
app.include_router(ws_routes.router)

_uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
_uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")


@app.get("/")
async def root():
    return {"message": "Welcome to TwinMind API"}
