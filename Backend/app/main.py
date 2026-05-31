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
from app.api.routes import health, auth, sessions, notes, materials, analytics, student_profile as sp_routes, learning_data as ld_routes, prediction as pred_routes, simulate as sim_routes, mentor as mentor_routes, twin as twin_routes
from app.api.routes import websocket as ws_routes
from app.ml.predictor import get_model  # warm up model at startup

Base.metadata.create_all(bind=engine)

# Add avatar_url column to existing DBs that predate this migration
with engine.connect() as _conn:
    try:
        _conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url TEXT"))
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
app.include_router(ws_routes.router)

_uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
_uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")


@app.get("/")
async def root():
    return {"message": "Welcome to TwinMind API"}
