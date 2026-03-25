from sqlalchemy import Column, Integer, ForeignKey, DateTime, Text, JSON
from sqlalchemy.sql import func

from app.db.database import Base


class InterviewEvaluation(Base):
    __tablename__ = "interview_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), nullable=False)
    question_index = Column(Integer, nullable=False)

    question_message_id = Column(Integer, ForeignKey("interview_messages.id"), nullable=True)
    answer_message_id = Column(Integer, ForeignKey("interview_messages.id"), nullable=False, unique=True)

    question_text = Column(Text, nullable=False)
    answer_text = Column(Text, nullable=False)

    overall_score = Column(Integer, nullable=False)
    communication_score = Column(Integer, nullable=False)
    technical_score = Column(Integer, nullable=False)
    structure_score = Column(Integer, nullable=False)
    confidence_score = Column(Integer, nullable=False)
    relevance_score = Column(Integer, nullable=False)

    strengths = Column(Text, nullable=False)
    improvements = Column(Text, nullable=False)
    missed_opportunities = Column(Text, nullable=False)
    ideal_answer = Column(Text, nullable=False)
    recommended_topics = Column(JSON, nullable=False, default=list)

    created_at = Column(DateTime(timezone=True), server_default=func.now())