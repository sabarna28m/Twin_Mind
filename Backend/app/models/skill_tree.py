from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base


class NodeProgress(Base):
    __tablename__ = "skill_node_progress"
    __table_args__ = (UniqueConstraint("user_id", "node_id", name="uq_user_node"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    node_id = Column(String(80), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="locked")  # locked|available|in_progress|mastered
    completion_pct = Column(Float, nullable=False, default=0.0)
    xp_earned = Column(Integer, nullable=False, default=0)
    lessons_completed = Column(Integer, nullable=False, default=0)
    quizzes_completed = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class XPTransaction(Base):
    __tablename__ = "xp_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    node_id = Column(String(80), nullable=True)
    activity_type = Column(String(30), nullable=False)  # quiz|lesson|task|challenge
    xp_amount = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SkillTreeAchievement(Base):
    __tablename__ = "skill_tree_achievements"
    __table_args__ = (UniqueConstraint("user_id", "achievement_id", name="uq_user_st_ach"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    achievement_id = Column(String(60), nullable=False)
    earned_at = Column(DateTime(timezone=True), server_default=func.now())
