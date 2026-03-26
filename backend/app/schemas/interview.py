from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class InterviewSessionCreate(BaseModel):
    interview_type: str
    role: str
    difficulty: str
    duration: int
    resume_id: Optional[int] = None
    job_description_id: Optional[int] = None


class InterviewSessionResponse(BaseModel):
    id: int
    user_id: int
    interview_type: str
    role: str
    difficulty: str
    duration: int
    resume_id: Optional[int] = None
    job_description_id: Optional[int] = None
    resume_title: Optional[str] = None
    job_description_title: Optional[str] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)