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

    standout_strengths: List[str]
    weak_areas: List[str]
    recommended_topics: List[str]
    question_count: int

    created_at: datetime

    model_config = ConfigDict(from_attributes=True)