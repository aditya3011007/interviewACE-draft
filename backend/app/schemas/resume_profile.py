from datetime import datetime
from typing import Any, Dict

from pydantic import BaseModel, ConfigDict


class ResumeProfileCreate(BaseModel):
    title: str
    raw_text: str


class ResumeProfileResponse(BaseModel):
    id: int
    user_id: int
    title: str
    raw_text: str
    extracted_profile: Dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
