from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import Base, engine
from app.models.interview import InterviewSession
from app.models.interview_evaluation import InterviewEvaluation
from app.models.interview_feedback import InterviewFeedback
from app.models.interview_message import InterviewMessage
from app.models.job_description_profile import JobDescriptionProfile
from app.models.resume_profile import ResumeProfile
from app.models.user import User
from app.routes import auth, interview, profiles, users

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
app.include_router(interview.router)
app.include_router(profiles.router)
app.include_router(auth.router)
app.include_router(users.router)


@app.get("/")
def root():
    return {"message": "InterviewAce AI backend is running"}