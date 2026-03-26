from typing import List

from pydantic import BaseModel


class ProfileComparisonResponse(BaseModel):
    resume_id: int
    job_description_id: int
    role_fit_summary: str
    match_areas: List[str]
    gap_areas: List[str]
    interview_risk_zones: List[str]
