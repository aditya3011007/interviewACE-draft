from datetime import datetime
from pydantic import BaseModel, ConfigDict


class InterviewMessageCreate(BaseModel):
    message: str


class InterviewMessageResponse(BaseModel):
    id: int
    session_id: int
    sender: str
    message: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)