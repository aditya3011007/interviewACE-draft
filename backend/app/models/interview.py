from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    interview_type = Column(String, nullable=False)
    role = Column(String, nullable=False)
    difficulty = Column(String, nullable=False)
    duration = Column(Integer, nullable=False)
    resume_id = Column(Integer, ForeignKey("resume_profiles.id"), nullable=True)
    job_description_id = Column(
        Integer,
        ForeignKey("job_description_profiles.id"),
        nullable=True,
    )
    planner_state = Column(JSON, nullable=True)
    followup_state = Column(JSON, nullable=True)
    status = Column(String, nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    resume = relationship("ResumeProfile", foreign_keys=[resume_id], lazy="joined")
    job_description = relationship(
        "JobDescriptionProfile",
        foreign_keys=[job_description_id],
        lazy="joined",
    )

    @property
    def resume_title(self):
        if self.resume is None:
            return None
        return self.resume.title

    @property
    def job_description_title(self):
        if self.job_description is None:
            return None
        return self.job_description.title