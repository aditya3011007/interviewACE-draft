from sqlalchemy import Column, Integer, ForeignKey, Text, DateTime, JSON
from sqlalchemy.sql import func

from app.db.database import Base


class InterviewFeedback(Base):
    __tablename__ = "interview_feedback"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), nullable=False, unique=True)

    overall_score = Column(Integer, nullable=False)
    communication_score = Column(Integer, nullable=False)
    technical_score = Column(Integer, nullable=False)
    problem_solving_score = Column(Integer, nullable=False)
    confidence_score = Column(Integer, nullable=False)

    strengths = Column(Text, nullable=False)
    improvements = Column(Text, nullable=False)
    summary = Column(Text, nullable=False)
    resume_jd_alignment_summary = Column(Text, nullable=True)

    standout_strengths = Column(JSON, nullable=False, default=list)
    weak_areas = Column(JSON, nullable=False, default=list)
    recommended_topics = Column(JSON, nullable=False, default=list)
    matched_strengths_for_job = Column(JSON, nullable=False, default=list)
    risky_gaps = Column(JSON, nullable=False, default=list)
    best_interview_stories = Column(JSON, nullable=False, default=list)
    next_practice_priorities = Column(JSON, nullable=False, default=list)
    question_count = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())