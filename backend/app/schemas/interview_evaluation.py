from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class InterviewEvaluationResponse(BaseModel):
    id: int
    session_id: int
    question_index: int

    question_message_id: Optional[int] = None
    answer_message_id: int

    question_text: str
    answer_text: str

    overall_score: int
    communication_score: int
    technical_score: int
    structure_score: int
    confidence_score: int
    relevance_score: int

    strengths: str
    improvements: str
    missed_opportunities: str
    ideal_answer: str
    recommended_topics: List[str]

    created_at: datetime

    model_config = ConfigDict(from_attributes=True)