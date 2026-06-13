from sqlalchemy import Column, Integer, Float, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class CommTwin(Base):
    __tablename__ = "comm_twin_state"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    # Core proficiency scores (0-100)
    fluency_score       = Column(Float, default=0.0)
    pronunciation_score = Column(Float, default=0.0)
    vocabulary_score    = Column(Float, default=0.0)
    grammar_score       = Column(Float, default=0.0)
    confidence_score    = Column(Float, default=0.0)
    interview_comm_score= Column(Float, default=0.0)
    overall_score       = Column(Float, default=0.0)

    # Activity counters
    sessions_count   = Column(Integer, default=0)
    words_reviewed   = Column(Integer, default=0)
    grammar_errors_fixed = Column(Integer, default=0)

    # JSON: score snapshots for analytics — [{date, event, fluency, grammar, vocab, confidence, overall}]
    score_history_json   = Column(Text, default="[]")
    # JSON: vocabulary words reviewed — list of word strings
    vocabulary_log_json  = Column(Text, default="[]")
    # JSON: last 20 activity summaries — [{date, type, transcript_snippet, scores, feedback}]
    activity_log_json    = Column(Text, default="[]")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
