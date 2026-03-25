from datetime import datetime
from pydantic import BaseModel, ConfigDict


class InterviewSessionCreate(BaseModel):
    interview_type: str
    role: str
    difficulty: str
    duration: int


class InterviewSessionResponse(BaseModel):
    id: int
    user_id: int
    interview_type: str
    role: str
    difficulty: str
    duration: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)