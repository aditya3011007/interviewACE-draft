from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.job_description_profile import JobDescriptionProfile
from app.models.resume_profile import ResumeProfile
from app.models.user import User
from app.schemas.job_description_profile import (
    JobDescriptionProfileCreate,
    JobDescriptionProfileResponse,
)
from app.schemas.profile_comparison import ProfileComparisonResponse
from app.schemas.resume_profile import ResumeProfileCreate, ResumeProfileResponse
from app.services.document_parser import parse_uploaded_document
from app.services.profile_extractor import (
    compare_resume_to_job_description,
    extract_job_description_profile,
    extract_resume_profile,
)

router = APIRouter(prefix="/profiles", tags=["profiles"])


def _validate_profile_payload(title: str, raw_text: str) -> tuple:
    clean_title = title.strip()
    clean_text = raw_text.strip()

    if not clean_title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    if not clean_text:
        raise HTTPException(status_code=400, detail="Document text cannot be empty")

    return clean_title, clean_text


def _get_resume_or_404(
    resume_id: int,
    current_user: User,
    db: Session,
) -> ResumeProfile:
    resume = (
        db.query(ResumeProfile)
        .filter(
            ResumeProfile.id == resume_id,
            ResumeProfile.user_id == current_user.id,
        )
        .first()
    )
    if not resume:
        raise HTTPException(status_code=404, detail="Resume profile not found")
    return resume


def _get_job_description_or_404(
    job_description_id: int,
    current_user: User,
    db: Session,
) -> JobDescriptionProfile:
    job_description = (
        db.query(JobDescriptionProfile)
        .filter(
            JobDescriptionProfile.id == job_description_id,
            JobDescriptionProfile.user_id == current_user.id,
        )
        .first()
    )
    if not job_description:
        raise HTTPException(status_code=404, detail="Job description profile not found")
    return job_description


@router.get("/resumes", response_model=List[ResumeProfileResponse])
def list_resumes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ResumeProfile)
        .filter(ResumeProfile.user_id == current_user.id)
        .order_by(ResumeProfile.created_at.desc(), ResumeProfile.id.desc())
        .all()
    )


@router.post("/resumes", response_model=ResumeProfileResponse)
def create_resume_from_text(
    payload: ResumeProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    title, raw_text = _validate_profile_payload(payload.title, payload.raw_text)
    extracted_profile = extract_resume_profile(raw_text)
    resume = ResumeProfile(
        user_id=current_user.id,
        title=title,
        raw_text=raw_text,
        extracted_profile=extracted_profile,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


@router.post("/resumes/upload", response_model=ResumeProfileResponse)
async def upload_resume(
    file: UploadFile = File(...),
    title: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filename, parsed_text = await parse_uploaded_document(file)
    resolved_title, resolved_text = _validate_profile_payload(
        title.strip() or filename,
        parsed_text,
    )
    extracted_profile = extract_resume_profile(resolved_text)

    resume = ResumeProfile(
        user_id=current_user.id,
        title=resolved_title,
        raw_text=resolved_text,
        extracted_profile=extracted_profile,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


@router.get("/resumes/{resume_id}", response_model=ResumeProfileResponse)
def get_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_resume_or_404(resume_id, current_user, db)


@router.delete("/resumes/{resume_id}")
def delete_resume(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume = _get_resume_or_404(resume_id, current_user, db)
    db.delete(resume)
    db.commit()
    return {"message": "Resume profile deleted successfully"}


@router.get("/job-descriptions", response_model=List[JobDescriptionProfileResponse])
def list_job_descriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(JobDescriptionProfile)
        .filter(JobDescriptionProfile.user_id == current_user.id)
        .order_by(JobDescriptionProfile.created_at.desc(), JobDescriptionProfile.id.desc())
        .all()
    )


@router.post("/job-descriptions", response_model=JobDescriptionProfileResponse)
def create_job_description_from_text(
    payload: JobDescriptionProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    title, raw_text = _validate_profile_payload(payload.title, payload.raw_text)
    extracted_profile = extract_job_description_profile(raw_text)
    job_description = JobDescriptionProfile(
        user_id=current_user.id,
        title=title,
        raw_text=raw_text,
        extracted_profile=extracted_profile,
    )
    db.add(job_description)
    db.commit()
    db.refresh(job_description)
    return job_description


@router.post("/job-descriptions/upload", response_model=JobDescriptionProfileResponse)
async def upload_job_description(
    file: UploadFile = File(...),
    title: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filename, parsed_text = await parse_uploaded_document(file)
    resolved_title, resolved_text = _validate_profile_payload(
        title.strip() or filename,
        parsed_text,
    )
    extracted_profile = extract_job_description_profile(resolved_text)

    job_description = JobDescriptionProfile(
        user_id=current_user.id,
        title=resolved_title,
        raw_text=resolved_text,
        extracted_profile=extracted_profile,
    )
    db.add(job_description)
    db.commit()
    db.refresh(job_description)
    return job_description


@router.get(
    "/job-descriptions/{job_description_id}",
    response_model=JobDescriptionProfileResponse,
)
def get_job_description(
    job_description_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_job_description_or_404(job_description_id, current_user, db)


@router.delete("/job-descriptions/{job_description_id}")
def delete_job_description(
    job_description_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job_description = _get_job_description_or_404(job_description_id, current_user, db)
    db.delete(job_description)
    db.commit()
    return {"message": "Job description profile deleted successfully"}


@router.get("/compare", response_model=ProfileComparisonResponse)
def compare_profiles(
    resume_id: int,
    job_description_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume = _get_resume_or_404(resume_id, current_user, db)
    job_description = _get_job_description_or_404(job_description_id, current_user, db)
    return compare_resume_to_job_description(
        resume.id,
        resume.extracted_profile,
        job_description.id,
        job_description.extracted_profile,
    )
