from sqlalchemy import Column, Integer, Float, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class CareerTwin(Base):
    __tablename__ = "career_twin_state"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    # Persisted component scores (0-100)
    resume_score = Column(Float, default=0.0)
    linkedin_score = Column(Float, default=0.0)
    interview_score = Column(Float, default=0.0)
    coding_score = Column(Float, default=0.0)
    employability_score = Column(Float, default=0.0)

    # JSON: list of skill strings extracted from resume / profile
    skills_json = Column(Text, default="[]")
    # JSON: list of certification strings
    certifications_json = Column(Text, default="[]")

    # Raw text of the most recently uploaded resume
    last_resume_text = Column(Text, default="")

    # LinkedIn Digital Twin — full analysis JSON from last upload/paste
    linkedin_profile_json = Column(Text, default="{}")
    # LinkedIn Digital Twin — persisted list of achievement/certificate objects
    linkedin_achievements_json = Column(Text, default="[]")

    # JSON array of score snapshots for analytics charts
    # Each entry: {"date": "YYYY-MM-DD", "event": "...", "resume": N, "linkedin": N,
    #              "interview": N, "coding": N, "employability": N}
    score_history_json = Column(Text, default="[]")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
