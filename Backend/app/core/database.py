from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from typing import Generator

from app.core.config import settings

# Render and some providers emit postgres:// — SQLAlchemy needs postgresql://
_db_url = settings.database_url
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql://", 1)

_is_sqlite = _db_url.startswith("sqlite")

if _is_sqlite:
    engine = create_engine(
        _db_url,
        connect_args={"check_same_thread": False},
    )
else:
    # PostgreSQL — connection pool tuned for Render free tier (1 shared DB)
    engine = create_engine(
        _db_url,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,       # reconnect on stale connections
        pool_recycle=300,         # recycle every 5 min
    )


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
