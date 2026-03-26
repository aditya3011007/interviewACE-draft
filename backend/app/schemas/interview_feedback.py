from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict


class InterviewFeedbackResponse(BaseModel):
    id: int
    session_id: int
    overall_score: int
    communication_score: int
    technical_score: int
    problem_solving_score: int
    confidence_score: int

    strengths: str
    improvements: str
    summary: str
    resume_jd_alignment_summary: str

    standout_strengths: List[str]
    weak_areas: List[str]
    recommended_topics: List[str]
    matched_strengths_for_job: List[str]
    risky_gaps: List[str]
    best_interview_stories: List[str]
    next_practice_priorities: List[str]
    question_count: int

    created_at: datetime

    model_config = ConfigDict(from_attributes=True)